var npm = require('npm');

npm.load({});

function npmInstall(path) {
  console.log("installing npm modules for", path);
  npm.prefix = path;
  npm.globalPrefix = path;
  npm.localPrefix = path;
  npm.commands.install([], function(err, data) {
    console.log(err, data);
  });
}

var delay = setTimeout(function() {
  npmInstall('/apps/Soapbox/master');
}, 1000);
