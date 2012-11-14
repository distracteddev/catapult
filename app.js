var pushover = require('pushover'),
    repos    = pushover('/git/repos');



repos.on('push', function (push) {
    console.log('push ' + push.repo + '/' + push.commit + ' (' + push.branch + ')');
    push.accept();
    //.clone target repo
    // npm install
    // start app with forever
    // send logs somewhere
});

repos.on('fetch', function (fetch) {
    console.log('fetch ' + fetch.commit);
    fetch.accept();
});

repos.on('info', function (info) {
  console.log('info ' + info.repo);
  info.accept();
});

var http = require('http');
var server = http.createServer(function (req, res) {
    console.log(req.url, req.body, req.method);
    repos.handle(req, res);
});
server.listen(7005);
