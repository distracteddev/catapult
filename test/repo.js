var should = require('chai').should(),
    qs     = require('querystring'),
    fs     = require('fs'),
    npm    = require('npm'),
    db     = require('../db'),
    config = require('../config'),
    Repo   = require('../repo');


// mock npm install so our tests dont take 40 seconds
Repo.prototype.npmInstall = function (cb) {
  cb(null);
};

// use payload.json as sample git hook data
var SAMPLE_GIT_PAYLOAD = qs.parse(fs.readFileSync('payload.json', 'utf8'));
SAMPLE_GIT_PAYLOAD = JSON.parse(SAMPLE_GIT_PAYLOAD.payload);

var SAMPLE_API_PAYLOAD = {
  githubId: 'distracteddev/soapbox'
};

suite('Repo');

test('#init with api payload', function() {
  var payload = SAMPLE_API_PAYLOAD;
  var nextPort = db.get('nextPort');
  var repo = new Repo(payload);
  repo.should.be.an['instanceof'](Repo);
  repo.branch.should.equal('master');
  repo.port.should.equal(nextPort);
  // ensure that the nextPort was incremented
  db.get('nextPort').should.equal(++nextPort);
});


test('#init with git hook payload', function() {
  var payload = SAMPLE_GIT_PAYLOAD;
  var nextPort = db.get('nextPort');
  var repo = new Repo(payload);
  repo.should.be.an['instanceof'](Repo);
  repo.branch.should.equal(payload.ref.split('/')[2]);
  repo.port.should.equal(nextPort);
  // ensure that the nextPort was incremented
  db.get('nextPort').should.equal(++nextPort);
});

test('#save and retrieve', function (done) {
  var repo = new Repo(SAMPLE_API_PAYLOAD);
  repo.save(function (err) {
    repo.should.deep.equal(db.get(repo.id));
    repo.should.deep.equal(repo.retrieve());
    done(err);
  });
});


test('#clone', function(done) {
  var repo = new Repo(SAMPLE_API_PAYLOAD);
  var localRoute = '127.0.0.1:' + repo.port;
  var mock_routes = {
    'www.zeus.ly': localRoute,
    'zeus.ly':     localRoute
  };
  repo.clone(function(err) {
    var routes = repo.routes;
    routes.should.deep.equal(mock_routes);
    done(err);
  });
});


test('#buildRoutes with a default branch (staging)', function() {
  var repo = new Repo(SAMPLE_GIT_PAYLOAD);
  repo.branch = 'staging';
  repo.buildRoutes();
  var localRoute = '127.0.0.1:' + repo.port;
  var mock_routes = {
    'soapbox-stg.localhost': localRoute,
    'soapbox-staging.localhost': localRoute
  };
  var routes = repo.routes;
  routes.should.deep.equal(mock_routes);
});

test('#buildRoutes with custom branch and NO defined domain', function() {
  var repo = new Repo(SAMPLE_GIT_PAYLOAD);
  repo.branch = 'custom-branch';
  repo.buildRoutes();
  var localRoute = '127.0.0.1:' + repo.port;
  var publicRoute = repo.name + '-' + repo.branch + '.' + config.hostname;
  var mock_routes = {};
  mock_routes[publicRoute] = localRoute;
  repo.routes.should.deep.equal(mock_routes);
});


test('#buildRoutes with custom branch and a defined domain', function() {
  var repo = new Repo(SAMPLE_GIT_PAYLOAD);
  repo.pkgDotJSON = {domain: 'test.com'};
  repo.branch = 'custom-branch';
  repo.buildRoutes();
  var localRoute = '127.0.0.1:' + repo.port;
  var publicRoute = repo.branch + '.' + repo.pkgDotJSON.domain;
  var mock_routes = {};
  mock_routes[publicRoute] = localRoute;
  repo.routes.should.deep.equal(mock_routes);
});


test('#start', function(done) {
  var repo = new Repo(SAMPLE_API_PAYLOAD);
  repo.start(done);
});

test('#start without repo (should fail)', function(done) {
  var repo = new Repo({githubId: 'distracteddev/deps'});
  repo.start(function(err) {
    //console.log(err);
    should.exist(err);
    done(null);
  });
});






