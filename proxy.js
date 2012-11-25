var proxy = require('http-proxy'),
    sugar = require('sugar'),
    db    = require('./db'),
    ipc   = require('./ipc'),
    config = require('./config'),
    fs    = require('fs');



var PORT = config.proxy_port || 80;
// our 'global' proxy table.
var proxyTable;

var startServer = function(options) {
  var server = proxy.createServer(options);
  server.listen(PORT);
  // stash our proxyTable instance
  proxyTable = server.proxy.proxyTable;
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
    console.log("Starting proxy on port:", String(PORT).yellow, "with routes:\n", options.router);
  } else {
  // otherwise, simply load the proxy table
    console.log("Refreshing the proxy table...");
    // the next two lines are copied straight from the http-proxy source
    // for handling new entries when the proxy-table changes.
    proxyTable.setRoutes(options.router);
    proxyTable.emit('routes', options.router);
  }
  
});


ipc.on('refreshProxy', function() {
  // fires the above load handler after
  // reading the newest entries from proxy.db
  db._load();
});



