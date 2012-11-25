var dbName = 'proxy.db';

var db = require('dirty')(dbName);

db.merge = function(key, obj) {
  if (obj) {
    var current = proxyDB.get(key) || {};
    Object.merge(current, obj, true);
    proxyDB.set(key, current);
  } else {
    throw new Error("proxyDB.merge requires both the key and the object to be merged as parameters");
  }
};


db.on('load', function() {
  // Seed DB with Default Data
  if (!(db.get('nextPort'))) {
    console.log("Initializing Proxy Database with default data");
    db.set('nextPort', 3000);
  } else if (db.get('nextPort') > 4000) {
    console.log("Resetting next availabe port to 3000. This is a problem if you have over 3000 active deploys");
    db.set('nextPort', 3000);
  }

  console.log("NEXT PORT AVAILABLE" , db.get('nextPort'));
});
module.exports = db;
