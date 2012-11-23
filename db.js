var proxyDB = require('dirty')('proxy.db');

proxyDB.merge = function(key, obj) {
  if (obj) {
    var current = proxyDB.get(key) || {};
    Object.merge(current, obj, true);
    proxyDB.set(key, current);
  } else {
    throw new Error("proxyDB.merge requires both the key and the object to be merged as parameters");
  }
};

exports.proxyDB = proxyDB;
