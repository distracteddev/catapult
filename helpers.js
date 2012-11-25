var fs   = require('fs'),
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
