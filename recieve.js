var pushReceive = require('github-push-receive');
var http = require('http');

var server = http.createServer(function (req, res) {
    if (req.url.split('/')[1] === 'hook') {
        req.pipe(pushReceive('http://localhost:7005')).pipe(res);
    } else {
        console.log(req);
        res.end('beep boop\n');
    }
});
server.listen(8050);
