var fs   = require('fs'),
    db   = require('./db'),
    Repo = require('./repo'),
    path = require('path');

exports.getStartFile = function (pkg, directory) {
  var startFile;
  if (pkg && pkg.scripts && pkg.scripts.start) {
    startFile = pkg.scripts.start.replace('node ', '');
  } else {
  // If its not defined, hunt for it using common names.
    var names = ['app.js','server.js', 'start.js'].filter(function(fileName) {
      return fs.existsSync(path.join(directory, fileName));
    });
    startFile = names[0];
  }
  return path.join(directory, startFile) || null;
};



exports.startRepos = function () {
  db.once('load', function() {
    console.log('Starting Repos');
    var delay = setTimeout(function() {
      db.forEach(function(id, entry) {
        // console.log(entry);
        var isRepo = (entry.id !== undefined);
        if (isRepo) {
          var repo = new Repo(entry);
          repo.start(function(err) {
            if (err) {
              console.error('Error Starting Repo on Startup', repo);
            }
          });
        }
      });
    }, 200);
  });
}