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
    db     = require('./db'),
    fs     = require('fs'),
    git    = require('gift'),
    npm    = require('npm'),
    ipc    = require('./ipc'),
    forever = require('forever-monitor'),
    colors = require('colors'),
    Notifier  = require('./notifier'),
    buildRoutes = require('./helpers'),
    Repo   = require('./repo'),
    mkdirp = require('mkdirp');

// Load an empty config for npm
npm.load({});
Notifier.start();

function handleHook(payload) {
  var  repo = new Repo(payload);
  repo.clone(function(err) {
    if (err) {
      return console.log('Error Cloning Repo', err);
    }
    console.log('Repo Cloned');
    repo.start(function(err) {
      if (err) {
        return console.log(err);
      }
      console.log('Repo Started');
    });
  });
}

module.exports = handleHook;
