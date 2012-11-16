var http = require('http');
var qs  = require('querystring');
var handler = require('./handle');

var server = http.createServer(function (req, res) {
    if (req.url.split('/')[1] === 'hook') {
        req.setEncoding('utf8');
        if (req.method === 'POST') {
            // buffer for the buffer
            var body = '';
            // parse the body
            req.on('data', function(data) {
                body += data;
            });
            req.on('end', function() {
              var parsed = qs.parse(body);
              try {
                if (parsed.payload) {
                  // extract the git hook payload
                  parsed = parsed.payload;
                }
                parsed = JSON.parse(parsed);
                console.log("Body Parsed", parsed);
                res.end("Hook Successfully Accepted");
                handler(parsed);
              } catch (e) {
                res.end("Error, Bad JSON Provided");
              }
            });
        }
    } else {
        console.log(req);
        res.end('beep boop\n');
    }
});
server.listen(8050);
