/**
 *  Plan to handle hooks:
 *
 *  1. Clone Project
 *  2. Install NPM deps
 *  3. Assign Port, Save hostname:port pair in proxy.json
 *  4. Start forever with assigned PORT.
 *  5. Restart Proxy
 *
**/
var path   = require('path'),
    db     = require('dirty')('proxy.db'),
    fs     = require('fs'),
    git    = require('gift'),
    npm    = require('npm'),
    ipc    = require('./ipc'),
    forever = require('forever-monitor'),
    mkdirp = require('mkdirp');

// Load an empty config for npm
npm.load({});

var branchMap = {'master': 0, 'production': 0, 'staging':1, 'development':2, 'stg':1, 'dev': 2};

function handleHook(payload) {
  // Check if branch pushed is one of the ones we care about
  payload.branch = payload.ref.split('/')[2];
  console.log("Detected a push for", payload.repository.name, payload.branch);
  if (!(payload.branch in branchMap)) {
    console.log("Detected a push for a branch we don't care about: ", payload.ref);
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
    syncLocalRepo(payload.directory);
  }
}

function createLocalRepo(payload) {
  // create the dir
  mkdirp.sync(payload.directory);
  // init the git repo
  git.init(payload.directory, function(err, params) {
    var repo = git(params.path);
    repo.remote_add('origin', payload.repository.url, function(err, params) {
      syncLocalRepo(payload, repo);
    });
  });
  // create a db object for this repo
  var basePort = db.get('nextPort') || 3000;
  db.set(payload.repository.url, {basePort: basePort});
  // each repo gets 3 ports reserved for itself.
  db.set('nextPort', basePort+4);
}

function syncLocalRepo(payload, repo) {
  if (typeof repo === 'string') {
    repo = git(repo);
  }
  repo.remote_fetch('origin', function(err, params) {
    repo.checkout(payload.branch, function(err, params) {
      var pkgPath = path.join(payload.directory, 'package.json');
      var pkg = require(pkgPath);
      updateSettingsForRepo(payload, pkg);
    });
  });
}

function updateSettingsForRepo(payload, pkg) {
  // create a routes object based on routes/domain/subdomain option
  // within the projects package.json
  payload.basePort = db.get(payload.repository.url).basePort;
  var routes = pkg.routes || buildRoutes(payload, pkg);

  db.set(payload.repository.url, {
    basePort: payload.basePort,
    routes:   routes
  }, function updated() {
    ipc.emit('refreshProxy');
  });

  console.log("Setting: ", payload.basePort, routes);
  npmInstall(payload, pkg);

}

function buildRoutes(payload, pkg) {
  var routes = {},
      domain = pkg.domain,
      localHost = '127.0.0.1:',
      basePort = +payload.basePort,
      subdomain = pkg.subdomain || pkg.name;

  if (domain) {
    // production
    routes['www.' + domain] = localHost + (basePort + 1);
    routes[domain]          = localHost + (basePort + 1);
    // staging
    routes['staging' + domain] = localHost + (basePort + 2);
    // development
    routes['dev' + domain] = localHost + (basePort + 3);
  } else if (subdomain) {
    var HOST_NAME = 'distracteddev.com';
    // production
    routes[subdomain + '.' + HOST_NAME] = localHost + (basePort + 1);
    // staging
    routes[subdomain + '-staging.' + HOST_NAME] = localHost + (basePort + 2);
    // development
    routes[subdomain + '-dev.' + HOST_NAME] = localHost + (basePort + 3);
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
    else     { launchForever(payload, pkg); }
  });
}


function launchForever(payload, pkg) {
  var dir = payload.directory,
      portOffset = branchMap[payload.branch],
      node_env = (portOffset < 2) ? 'production' : 'development',
      child = new (forever.Monitor)(startFile, {
    cwd: dir,
    max: 5,
    silent: false,
    pidFile: path.join(dir, 'my.pid'),
    // each app has a basePort, and the env determines the offset
    env: { 
      PORT: payload.basePort + portOffset,
      NODE_ENV: node_env
    },
    logfile: path.join(dir, 'forever.log'),
    outFile: path.join(dir, 'out.log'),
    errFile: path.join(dir, 'error.log')
  });

  child.on('exit', function() {
    var msg = [
      'EXIT:',
      payload.repository.name,
      payload.branch,
      'has exiteed'
    ].join(' ' );

    console.log(msg);
  });
  child.start();
}

module.exports = handleHook;
