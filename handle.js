/**
 *  Plan to handle hooks:
 *
 *  1. Clone/Sync Project
 *  2. Install NPM deps
 *  3. Assign Port, Save hostname:port pair in proxy.json
 *  4. Start forever with assigned port.
 *
**/
var path   = require('path'),
    db     = require('./db').proxyDB,
    fs     = require('fs'),
    git    = require('gift'),
    npm    = require('npm'),
    ipc    = require('./ipc'),
    forever = require('forever-monitor'),
    colors = require('colors'),
    Notifier  = require('./notifier'),
    mkdirp = require('mkdirp');

// Load an empty config for npm
npm.load({});

var BRANCH_MAP = {'master': 0, 'production': 0, 'staging':1, 'development':2, 'stg':1, 'dev': 2};
// Child Process storage container.
var CHILDREN = {};

function handleHook(payload) {
  // Check if branch pushed is one of the ones we care about
  // Note: If no branch is provided, assume master.
  payload.branch = payload.branch || payload.ref.split('/')[2] || 'master';
  console.log("Detected a push for", payload.repository.name, payload.branch);
  if (!(payload.branch in BRANCH_MAP) ||
      payload.repository.name.toLowerCase() === 'catapult') {
    console.log("Detected a push for a branch we don't care about: ", payload.ref || payload.branch);
    return;
  }
  cloneProject(payload);

}

function cloneProject(payload) {
  console.log("Starting Clone Project");
  payload.directory = path.join('/apps', payload.repository.name, payload.branch);
  console.log('Directory:', payload.directory);
  if (!fs.existsSync(payload.directory)) {
    console.log("Repo not found, creating it now...");
    createLocalRepo(payload);
  } else {
    syncLocalRepo(payload);
  }
}

function createLocalRepo(payload) {
  // create the dir
  mkdirp.sync(payload.directory);
  // init the git repo
  git.init(payload.directory, function(err, params) {
    if (err) return console.error(err);
    var repo = git(params.path);
    repo.remote_add('origin', payload.repository.url, function(err, params) {
      syncLocalRepo(payload);
    });
  });
  // create a db object for this repo
  var basePort = db.get('nextPort') || 3000;
  db.set(payload.repository.url, {basePort: basePort});
  // each repo gets 3 ports reserved for itself.
  db.set('nextPort', basePort+4);
}

function syncLocalRepo(payload) {
  var repo = git(payload.directory);
  repo.remote_fetch('origin', function(err, params) {
    if (err) return console.error(err);
    repo.checkout(payload.branch, function(err, params) {
      if (err) return console.error(err);
      repo.git('pull', function(err, params) {
        if (err) return console.error(err);
        var pkgPath = path.join(payload.directory, 'package.json');
        var pkg = require(pkgPath);
        updateSettingsForRepo(payload, pkg);
      });
    });
  });
}

function updateSettingsForRepo(payload, pkg) {
  // create a routes object based on routes/domain/subdomain option
  // within the projects package.json
  var repoData = db.get(payload.repository.url) || {};
  // If we don't have a basePort at this point, give a default port
  // that is out of the range of the nominal case
  payload.basePort =  repoData.basePort || 9000;
  var routes = pkg.routes || buildRoutes(payload, pkg);
  // stash them incase we need them later;
  payload.routes = routes;
  db.merge(payload.repository.url, {
    basePort: payload.basePort,
    routes:   routes,
    subdomain: pkg.subdomain || pkg.name
  }, function updated() {
    ipc.emit('refreshProxy');
  });

  console.log("Setting Routes: ", routes);
  npmInstall(payload, pkg);

}

// TODO: Move to helper.js
// Perhaps we should only build the route for the branch
// being currently deployed. Then we can more easily handle
// any branch in the future just by letting it through the hook.
function buildRoutes(payload, pkg) {
  var routes = {},
      domain = pkg.domain,
      localHost = '127.0.0.1:',
      basePort = +payload.basePort,
      subdomain = pkg.subdomain || pkg.name;

  if (domain) {
    domain = domain.toLowerCase();
    // production
    routes['www.' + domain] = localHost + (basePort + 0);
    routes[domain]          = localHost + (basePort + 0);
    // staging
    routes['staging.' + domain] = localHost + (basePort + 1);
    // development
    routes['dev.' + domain] = localHost + (basePort + 2);
  }

  if (subdomain) {
    subdomain = subdomain.toLowerCase();
    var HOST_NAME = 'distracteddev.com';
    // production
    routes[subdomain + '.' + HOST_NAME] = localHost + (basePort + 0);
    // staging
    routes[subdomain + '-staging.' + HOST_NAME] = localHost + (basePort + 1);
    // development
    routes[subdomain + '-dev.' + HOST_NAME] = localHost + (basePort + 2);
  }

  return routes;
}

function npmInstall(payload, pkg) {
  var dir = payload.directory;
  console.log("installing npm modules for", dir);
  npm.prefix = dir;
  npm.globalPrefix = dir;
  npm.localPrefix = dir;
  npm.commands.install([], function(err, data) {
    if (err) { throw err; }
    // TODO: Notify User on Error (Email / OSX)
    // TODO: Run Test Suite
    else {
      console.log("All npm modules installed sucessfully".green);
      launchForever(payload, pkg); 
    }
  });
}


// TODO: Write doc blocks
function launchForever(payload, pkg) {
  // first try to stop the process that might already be running
  stopForever(payload, pkg);
  var dir = payload.directory,
      portOffset = BRANCH_MAP[payload.branch],
      node_env = (portOffset < 2) ? 'production' : 'development',
      startFile;


  // TODO: Move into helpers
  // We need to detect the name of the start
  if (pkg.scripts.start) {
    startFile = pkg.scripts.start.replace('node ', '');
  } else {
  // If its not defined, hunt for it using common names.
    var names = ['app.js','server.js', 'start.js'].filter(function(fileName) {
      return fs.existsSync(path.join(payload.directory, fileName));
    });
    startFile = names[0];
    if (!startFile) {

      // abort the launch since we dont know what file to run
      return;
    }
  }

  // join the name with the cwd
  startFile = path.join(dir, startFile);


  // build the env variables to launch the app with
  var childEnv = { 
    PORT: payload.basePort + portOffset,
    NODE_ENV: node_env
  };

  // we support pkg.config with the proper prefix
  Object.each(pkg.config, function (key, value) {
    var prefix = 'npm_package_config_';
    childEnv[prefix + key] = value;
  });
  // and we support the non-standard but logical pkg.env
  Object.merge(childEnv, pkg.env);


  // Set-up the forever process.
  var child = new (forever.Monitor)(startFile, {
    cwd: dir,
    max: 10,
    silent: true,
    env: childEnv,
    // each app has a basePort, and the env determines the offset
    logfile: path.join(dir, 'forever.log'),
    outFile: path.join(dir, 'out.log'),
    errFile: path.join(dir, 'error.log')
  });

  // Listen for child events
  child.on('exit', function(err) {
    if (err) console.error(err);
    var log = [
      'EXIT:',
      payload.repository.name,
      payload.branch,
      'has exiteed'
    ].join(' ');

    // Debug statement so we know when 'exit'
    // was reaches rather than 'stop'
    console.log(log.red);
    payload.pid = 0;
    updateStatus('STOPPED', payload);
    var msg = {
      type: 'stopped/fail',
      text: 'The Application Stopped'
    };
    Notifier.send(msg, payload);
  });

  child.on('start', function(err, proc) {
    if (err) console.error(err);
    payload.pid = proc.pid;
    updateStatus('STARTED', payload);
    var msg = {
      type: 'deploy/pass',
      text: 'The Application was succesfully deployed'
    };
    Notifier.send(msg, payload);
  });

  child.on('restart', function(err, proc) {
    payload.pid = proc.pid;
    updateStatus('RESTARTED', payload);
    var msg = {
      type: 'restart/info',
      text: 'The Application was Restarted'
    };
    Notifier.send(msg, payload);
  });

  child.on('error', function(err) {
    console.error("Error in child app", err);
    var msg = {
      type: 'error/fail',
      text: err.toString()
    };
    Notifier.send(msg, payload);
  });

  // Launch forever, all systems go.
  child = child.start();
  // save the child for later
  CHILDREN[payload.repository.url + payload.branch] = child;
  console.log("Starting".blue, payload.repository.name.green, payload.branch.yellow);
}


function stopForever(payload) {
  var repoId = payload.repository.url;

  // If we've managed to stay up, then we can terminate the
  // process using our saved child instance
  if (CHILDREN[repoId]) {
    CHILDREN[repoId].stop();
  } else if (db.get(repoId).pid) {
  // Otherwise, get the pid and kill it
    var pid = +db.get(repoId).pid;
    if (pid >  0) {
      console.log("Killing process with pid".red, pid);
      try {
        process.kill(pid);
      } catch (e) {
        console.error("Error while trying to kill process", e.code);
      }
    }
  } else {
    console.log("Tried stopping", payload.repository.name, "but no child or pid was found");
  }
}

function updateStatus(status, payload) {
  var obj = {
    status: status,
    pid: payload.pid || 0
  };

  db.merge(payload.repository.url, obj);
  console.log("Updating Status for".yellow,  payload.repository.name.blue, obj);
}

module.exports = handleHook;
