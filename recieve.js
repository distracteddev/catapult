var startAll  = require('./helpers').startRepos,
    Notifier  = require('./notifier').start(startAll),
    http      = require('http'),
    qs        = require('querystring'),
    sugar     = require('sugar'),
    handler   = require('./handle'),
    ipc       = require('./ipc.js'),
    proxy     = require('./proxy.js'),
    config    = require('./config'),
    colors  = require('colors');

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
                //console.log("Body Parsed", parsed);
                res.end("Hook Successfully Accepted");
              } catch (e) {
                console.log(e);
                res.end("Error, Bad JSON Provided");
                return;
              }
              // console.log(parsed);
              handler(parsed);
            });
        }
    } else {
        console.log("Non Hook Request Detected");
        res.end('beep boop\n');
    }
});

var port = config.hook_port || 8050;
server.listen(port);
console.log("Starting git-hook reciever on port".green, String(port).yellow);
