var express = require("express");
var bodyParser = require("body-parser");
var log = require('log4js').getLogger('fsrv');
var app = express();
var fs = require('fs');
var uuid = require('node-uuid');
var request = require('request');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var tmp = '/Users/rayfang/tmp/';
var raw = '/Users/rayfang/sequences/';
const INTERVAL = 5000;

var server = app.listen(process.env.PORT || 3001, function () {
    log.debug("File server listening on port %s...", server.address().port);
});

setInterval(function() {
    log.debug('scan directory');
    fs.readdir(tmp, function(err, items) {
        if ( ! err && items.length > 0 ) {

            /** create dir for each day **/
            var now = new Date().toISOString();
            var todayDir = now.substring(0, 10);

            if (!fs.existsSync(todayDir)){
                fs.mkdirSync(raw + todayDir);
            }

            log.debug(items);
            for ( var i =  0; i < items.length; i++) {
                var new_path = raw + todayDir + '/' + items[i];


                if (items[i].charAt(0) != '.'){   // exclude hide directory

                    fs.rename(tmp + items[i], new_path, function (err) {
                        log.error(err);
                    })

                    /** add code to extract JSON file and create the metadata object **/

                    var url = 'http://localhost:3000/api/sequence/insert';
                    var sequence = {path: new_path, meta: 'extracted JSON object'};
                    var options = {
                        url: url,
                        json: true,
                        body: sequence,
                        timeout: 1500
                    };

                    request.put(options, function(error, response, body) {
                        log.debug('update path response', response, 'body', body, 'error', error);
                        if ( error ) {
                            log.error('update failed', error);
                        }
                        else {
                            if ( response.statusCode == 200 ) {
                                log.debug('update maybe success', body);
                            }
                            else {
                                log.error('update failed', response.statusCode);
                            }
                        }
                    });

                }


            }
        }
    });
}, INTERVAL);



//create UUID//

// var buf = new Buffer(16);
// for ( item : items ) {
//     var id = uuid.v4(null, buf, 0);
//     var d0 = id.toString('hex', 0, 6);
//     var d1 = id.toString('hex', 6, 11);
//     var d2 = id.toString('hex', 11, 16);
//     fs.mkdirSync(raw_dir + d0 + '/' + d1 + '/' + d2);
// }