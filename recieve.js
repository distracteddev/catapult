var pushReceive = require('github-push-receive');
var http = require('http');
var qs  = require('querystring');

var server = http.createServer(function (req, res) {
    if (req.url.split('/')[1] === 'hook') {
        console.log(req);
        req.setEncoding('utf8');
        if (req.method === 'POST') {
            var body = '';
            req.on('data', function(data) {
                body += data;
            });
            req.on('end', function() {
                console.log("Body Parsed", JSON.parse(qs.parse(body).payload));
            });
        }
    } else {
        console.log(req);
        res.end('beep boop\n');
    }
});
server.listen(8050);
