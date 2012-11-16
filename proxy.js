var proxy = require('http-proxy'),
    sugar = require('sugar'),
    db    = require('dirty')('proxy.db'),
    ipc   = require('./ipc'),
    fs    = require('fs');




var proxyTable;
var startServer = function(options) {
  var server = proxy.createServer(options);
  server.listen(80);
  proxyTable = server.proxy.proxyTable;
  server.proxy.on('end', function() {
    console.log("Request proxied");
  });
  proxyTable.on('routes', function(routes) {
    console.log("new routes", routes);
  });
};

db.on('load', function() {

  var options = { hostnameOnly: true },
      router  = {};
  db.forEach(function(repo, options) {
    if (options.routes) {
      Object.merge(router, options.routes);
    }
  });

  options.router = router;
  // if the proxy has not started, start it
  if (!proxyTable) {
    startServer(options);
    console.log("Starting proxy with: ", options);
  } else {
  // otherwise, simply load the proxy table
    console.log("Refreshing the proxy table...");
    proxyTable.setRoutes(options.router);
    proxyTable.emit('routes', options.router);
  }
  
});


ipc.on('refreshProxy', function() {
  db._load();
});



