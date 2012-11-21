var proxyDB = require('dirty')('proxy.db');

proxyDB.merge = function(key, obj) {
  if (obj) {
    var current = db.get(key) || {};
    Object.merge(current, obj, true);
    db.set(key, current);
  } else {
    throw new Error("db.merge requires both the key and the object to be merged as parameters");
  }
};

exports.proxyDB = proxyDB;
