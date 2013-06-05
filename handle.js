/**
 *  Plan to handle hooks:
 *
 *  1. Clone/Sync Project
 *  2. Install NPM deps
 *  3. Assign Port, Save hostname:port pair in proxy.json
 *  4. Start forever with assigned port.
 *
**/
var Repo = require('./repo');


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
