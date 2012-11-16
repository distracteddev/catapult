var proxy = require('http-proxy'),
    sugar = require('sugar'),
    db    = require('dirty')('proxy.db'),
    fs    = require('fs');

var startServer = function(options) {
  var server = proxy.createServer(options);
  server.listen(80);
};

db.on('load', function() {

  var options = { hostnameOnly: true },
      host    = '127.0.0.1:',
      router  = {};
  db.forEach(function(repo, options) {
    if (options.routes) {
      Object.merge(router, options.routes);
    }
  });

  options.router = router;
  console.log("Starting proxy with: ", options);
  startServer(options);

});
