var config      = require('./config'),
    db          = require('./db'),
    ipc         = require('./ipc'),
    Notifier    = require('./notifier'),
    helpers     = require('./helpers'),
    sugar       = require('sugar'),
    fs          = require('fs'),
    git         = require('gift'),
    npm         = require('npm'),
    forever     = require('forever-monitor'),
    colors      = require('colors'),
    mkdirp      = require('mkdirp'),
    path        = require('path');

// programmatic npm config
npm.load({
  loglevel: 'error',
  production: true
});
var APP_DIR = config.APP_DIR || '/apps';

// TODO: Put in some protection and an optional override
// when trying to create a repo with a githubId that already exists.
function Repo(payload) {

  this.id = payload.id;

  // id provided, retrieve data from db, attatch to this
  if (this.id) {
    Object.merge(this, this.retrieve(), true);
  }

  // normalize args since we accept githooks as well as client commands
  if (payload) {
    this.normalizePayload(payload);
  }

  if (!this.pkgDotJSON) {
    this.pkgDotJSON = null;
  }

  // If no port is assigned, assign the next one available.
  if (!this.port) {
    this.port = +db.get('nextPort');
    db.set('nextPort', this.port+1);
  }
}

Repo.create = function (payload) {
  return new Repo(payload);
};

Repo.prototype.normalizePayload = function(payload) {
  // these params are only passed via a git-hook and are not present
  // in the CLI API Calls
  var isGitHook = Boolean(payload.repository && payload.ref);

  if (isGitHook) {
    this.owner     = payload.repository.owner.name;
    this.name      = payload.repository.name.toLowerCase();
    this.branch    = payload.ref.split('/')[2];
    this.url       = payload.repository.url;
  } else if (payload.githubId) {
    this.owner     = payload.githubId.split('/')[0];
    this.name      = payload.githubId.split('/')[1];
    this.branch    = payload.branch;
    this.url       = 'https://github.com/{owner}/{name}'.assign(this);
  }

  // enforced defaults
  this.branch    = this.branch || 'master';
  this.directory = path.join(APP_DIR, this.name, this.branch);
  this.gitUrl    = this.url.replace('https://', 'git://');

  if (this.owner && this.name) {
    this.id = '{owner}/{name}/{branch}'.assign(this);
  } else {
    throw new Error("A Repo must be initialized with at least the names of the owner and the repo");
  }
};

Repo.prototype.save = function(cb) {
  //var saveObj = this;
  var saveObj = Object.merge({}, this, false);
  // monitor is a class that should not be serialized, we simply
  // store it to the Repo object so each repo has a reference
  // to its child forever-monitor instance.
  if (saveObj.monitor) {
    saveObj.monitor = null;
  }
  db.set(this.id, saveObj, cb);
};

Repo.prototype.retrieve = function() {
  return db.get(this.id);
};

Repo.prototype.clone = function (cb) {
  console.log("Starting Clone Project");
  //console.log('Directory:',this.directory);
  if (!fs.existsSync(this.directory)) {
    console.log("Repo not found, creating it now...");
    this.createLocal(cb);
  } else {
    console.log("Repo found, syncing it now...");
    this.syncLocal(cb);
  }
};

Repo.prototype.createLocal = function (cb) {
  // create the dir
  mkdirp.sync(this.directory);
  // init the git repo
  var that = this;
  git.init(this.directory, function(err, params) {
    if (err) { return cb(err); }
    var repo = git(params.path);
    repo.remote_add('origin', that.gitUrl, function(err, params) {
      if (err) { return cb(err); }
      that.syncLocal(cb);
    });
  });
};


Repo.prototype.syncLocal = function (cb) {
  var repo = git(this.directory);
  var that = this;
  repo.remote_fetch('origin', function(err) {
    if (err) {
      return cb(err);
    }
    repo.checkout(that.branch, function(err) {
      if (err) {
        return cb(err);
      }
      repo.git('pull', function(err) {
        if (err) {
          return cb(err);
        }
        var pkgPath = path.join(that.directory, 'package.json');
        try {
          that.pkgDotJSON = JSON.parse(fs.readFileSync(pkgPath));
        } catch (e) {
          throw e;
        }
        that.buildRoutes();
        that.npmInstall(cb);
      });
    });
  });

};

// branch -> subdomain map
DEFAULT_BRANCH_MAP = {
  master: ['www', ''],
  staging: ['stg', 'staging'],
  development: ['dev', 'development']
};

Repo.prototype.buildRoutes = function () {
  var pkg        = this.pkgDotJSON || {},
      branchMap  = pkg.branchMap || DEFAULT_BRANCH_MAP,
      domains    = pkg.domains || (pkg.domain && [pkg.domain]),
      // use the name of the package over the one passed via the API
      appName    = pkg.subdomain || pkg.name || this.name,
      localHost  = '127.0.0.1:',
      proxyTo    = localHost + this.port,
      HOST_NAME  = config.hostname,
      subdomains = [],
      routes     = {};

  if (this.branch in branchMap) {
    subdomains = branchMap[this.branch];
  } else {
    subdomains = [this.branch];
  }

  var notUsingCustomDomain = Boolean(!domains);
  if (notUsingCustomDomain) {
    domains    = [HOST_NAME];
    subdomains = subdomains.map(function(subdomain) {
      if (subdomain !== '') { subdomain = '-' + subdomain; }
      return appName + subdomain;
    });
  }

  domains.forEach(function(domain) {
    subdomains.forEach(function(subdomain) {
      if (subdomain !== '') { subdomain += '.'; }
      var proxyFrom = subdomain + domain;
      routes[proxyFrom] = proxyTo;
    });
  });

  this.routes = routes;
  this.save();
  ipc.emit('refreshProxy');
};


Repo.prototype.npmInstall = function (cb) {
  var that = this;
  var dir  = that.directory;
  console.log("installing npm modules for", dir);
  npm.prefix = dir;
  npm.globalPrefix = dir;
  npm.localPrefix = dir;
  npm.commands.update([], function(err, data) {
    if (err) {
      console.error('Error Trying to Install NPM Modules');
      cb(err);
      return;
    }
    // TODO: Notify User on Error (Email / OSX)
    // TODO: Run Test Suite and save/host output.
    else {
      console.log("All npm modules installed sucessfully".green);
      cb(null);
    }
  });
};


Repo.prototype.start = function (cb) {
  if (!fs.existsSync(this.directory)) {
    cb(new Error("Cannot Start a Repo without Cloning it First"));
    return;
  }
  // just in case...
  this.stop();

  var node_env = (this.branch === 'master') ? 'production' : 'development',
      startFile = helpers.getStartFile(this.pkgDotJSON, this.directory),
      dir  = this.directory;


  if (!startFile) {
    var err = new Error('A Start File Could Not be Found');
    cb(err);
    return;
  }

  var childEnv = {
    PORT: this.port,
    NODE_ENV: node_env
  };

  // extract env variables from pkg.json and add it to the child_env
  if (this.pkgDotJSON && this.pkgDotJSON.config) {
    // we support pkg.config with the proper prefix
    Object.each(this.pkgDotJSON.config, function (key, value) {
      var prefix = 'npm_package_config_';
      childEnv[prefix + key] = value;
    });
  } else if (this.pkgDotJSON) {
    // and we support the non-standard but logical pkg.env
    Object.merge(childEnv, this.pkgDotJSON.env);
  }

  // Set-up the forever process.
  var child = new (forever.Monitor)(startFile, {
    cwd: dir,
    max: 10,
    silent: true,
    env: childEnv,
    spawnWith: {},
    // each app has a basePort, and the env determines the offset
    logfile: path.join(dir, 'forever.log'),
    outFile: path.join(dir, 'out.log'),
    errFile: path.join(dir, 'error.log')
  });

  this.bindChildListeners(child);
  child = child.start();
  this.childData = child.data;
  this.pid = this.childData.pid;
  this.monitor = child;
  this.save();

  cb(null);
};

// TODO: The Child Listeners should listen on
// 'start', 'restart', 'exit', and 'error' and
// update this.status as well as send out notifications
// using Notifier.send. See Handle.js L189-244 for the old
// implementation.
Repo.prototype.bindChildListeners = function (child) {

  var that = this;

  // Listen for child events
  child.on('exit', function(err) {
    if (err) console.error(err);
    var log = [
      'EXIT:',
      that.name,
      that.branch,
      'has exited'
    ].join(' ');

    // Debug statement so we know when 'exit'
    // was reaches rather than 'stop'
    console.log(log.red);
    updateStatus('STOPPED', that);
    var msg = {
      type: 'stopped/fail',
      text: 'The Application Stopped'
    };
    Notifier.send(msg, that);
  });

  child.on('start', function(err, proc) {
    if (err) console.error(err);
    updateStatus('STARTED', that);
    var msg = {
      type: 'deploy/pass',
      text: 'The Application was succesfully deployed'
    };
    Notifier.send(msg, that);
  });

  child.on('restart', function(err, proc) {
    that.pid = proc.pid;
    updateStatus('RESTARTED', that);
    var msg = {
      type: 'restart/info',
      text: 'The Application was Restarted'
    };
    Notifier.send(msg, that);
  });

  child.on('error', function(err) {
    console.error("Error in child app", err);
    var msg = {
      type: 'error/fail',
      text: err.toString()
    };
    console.log('Child Error', msg);
    Notifier.send(msg, that);
  });
};

Repo.prototype.stop = function () {
  if (this.monitor) {
    this.monitor.stop();
  } else if (this.pid) {
    var pid = +this.pid;
    if (pid > 0) {
      try {
        process.kill(pid);
      } catch (e) {}
    }
  }
};

Repo.prototype.restart = function () {
  if (this.monitor) {
    this.monitor.restart();
  } else {
    this.stop();
    this.start();
  }
};

function updateStatus(status, payload) {
  var obj = {
    status: status,
    pid: payload.pid || 0
  };

  db.merge(payload.id, obj);
  console.log("Updating Status for".yellow,  payload.name, obj);
}


// TODO: Probably don't need to export the whole class and instead
// should expose the .create and .retrieve methods only.
// (for the sake of information hiding and all that crap)
module.exports = Repo;
