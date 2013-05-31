var Hook = require('tinyhook').Hook,
    config = require('./config'),
    colors  = require('colors');

var serverOpts = {
  port: config.notifier_port,
  host: config.hostname || 'localhost'
};

var Notifier = new Hook(serverOpts);
// TODO: Integrate commands such as this for logging
var tailLog = 'osascript -e \'tell app "Terminal"\n\tdo script "ssh root@{host} tail -f -n 200 {logFile}';
// tails both the err and the out log files
var tailLogs = 'osascript -e \'tell app "Terminal"\n\tdo script "ssh root@{host} tail -f -n 200 {outFile} -f -n {errFile}';


var STARTED = false;

Notifier.start = function(callback) {
  callback = callback || function() {};
  if (serverOpts.port && serverOpts.host) {
    Notifier.listen(function(err) {
      if (err) {
        // TODO: Log and continue
        throw err;
      } else {
        callback(null);
        console.log("OSX-Notifier Started with".green, JSON.stringify(serverOpts).yellow);
        STARTED = true;
      }
    });
  }
};

// TODO: Remove this hacky bullshit once we refactor the handle submodule
var BRANCH_MAP = {'master': 0, 'production': 0, 'staging':1, 'development':2, 'stg':1, 'dev': 2};

Notifier.send = function(msg, repo) {
  if (!STARTED) {
    throw new Error('You must start the Notifier before trying to send messages through it');
  }
  var app = {},
      notif = {};
  // Pull the details we care about out of repo
  app.name = repo.name
  app.branch = repo.branch;
  app.url = repo.name.url;
  // build the notification object
  notif.name = '{1} ({2})'.assign(app.name, app.branch);
  notif.type = msg.type;
  notif.message = msg.text;
  // TODO: Remove this too...
  notif.url = Object.keys(repo.routes)[BRANCH_MAP[app.branch]];

  // validations and defaults
  if (typeof notif.url !== 'string') {
    delete notif.url;
  } else if (notif.url.indexOf('http://') !== 0) {
    notif.url = 'http://' + notif.url;
  }

  // Fire off the notification
  this.emit('notification', notif);
  // TODO: Remove this once I'm confident that all the right
  // notifications are being sent.
  console.log("Broadcasting notification to client:\n", notif);
};


module.exports = Notifier;
