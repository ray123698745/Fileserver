var express = require("express");
var bodyParser = require("body-parser");
var log = require('log4js').getLogger('fsrv');
var app = express();
var fs = require('fs');
var uuid = require('node-uuid');
var request = require('request');
var path = require('./config');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var tmp = path.temp;
var seq = path.seq;
// var failed = '/Users/rayfang/failed/';

var url = 'http://localhost:3000/api/sequence/insert';

const INTERVAL = 5000;

var server = app.listen(process.env.PORT || 3002, function () {
    log.debug("File server listening on port %s...", server.address().port);
});

// setInterval(function() {

    log.debug('scan directory');
    fs.readdir(tmp, function(err, items) {
        if ( ! err && items.length > 0 ) {

            log.debug(items);


            for ( var i =  0; i < items.length; i++) {   // items.forEach(function(item){ ... });

                if (items[i].charAt(0) != '.'){   // exclude hidden directory


                    /** add code to extract JSON file and create the metadata object **/


                    // change to readLine
                    // var file = JSON.parse(fs.readFileSync('/Users/rayfang/sequences/sequence_1/test.json', 'utf8'));
                    // log.debug('read file: ',file);


                    // var date = new Date(2016,  24);

                    var sequence = {

                        location: {country: "Italy", state: "Emilia-Romagna", city: "Parma"},
                        keywords: ["Sunny", "Urban", "Bright"],
                        gps: {x: 0, y: 0},
                        avg_speed: 0,
                        capture_time: "2016-06-07-12:08:01",
                        frame_number: 8653,
                        usage: "Training",
                        file_location: [{site: "us", root_path: "/vol1/SuperCam-2016-06-07-12:08:01"}, {site: "it", root_path: ""}],
                        cameras: [
                            {
                                name: "Front_Stereo",
                                is_stereo: true,
                                yuv: [{version: "v1", desc: "daytime"}],
                                annotation: {}
                            }
                        ]
                    };


                    var options = {
                        url: url,
                        json: true,
                        body: sequence,
                        timeout: 1500
                    };


                    // save dir before callback
                    function call_put(path) {

                        request.put(options, function(error, response, body) {
                            // log.debug('update path response', response, 'body', body, 'error', error);
                            // log.debug('import body: ', body, 'error: ', error);

                            if ( error ) {
                                log.error('Import failed', error);

                                // rename to failed folder
                                // fs.rename(tmp + dir, failed + dir, function (err) {
                                //     if(err)
                                //         log.error("rename error: " + err);
                                //     else
                                //         log.debug("rename success");
                                // })
                            }
                            else {
                                if ( response.statusCode == 200 ) {
                                    log.debug('Import maybe success', body);
                                    log.debug('before rename dir: ', path);

                                    // rename folder by _id
                                    // fs.rename(tmp + path, seq + body._id, function (err) {
                                    //     if(err){
                                    //         log.error("rename error: " + err);
                                    //         log.debug('dir: ', path);
                                    //         // rollback database
                                    //
                                    //     } else{
                                    //         log.debug("rename success");
                                    //         log.debug('dir: ', path);
                                    //     }
                                    // })
                                }
                                else {
                                    log.error('update failed', response.statusCode);
                                }
                            }
                        });
                    };

                    call_put(items[i]);

                }
            }
        }
    });
// }, INTERVAL);



// check disk space: df -h /supercam/vol1


/** create dir for each day **/
// var now = new Date().toISOString();
// var todayDir = now.substring(0, 10);
//
// if (!fs.existsSync(raw + todayDir)){
//     fs.mkdirSync(raw + todayDir);
// }

//create UUID//

// var buf = new Buffer(16);
// for ( item : items ) {
//     var id = uuid.v4(null, buf, 0);
//     var d0 = id.toString('hex', 0, 6);
//     var d1 = id.toString('hex', 6, 11);
//     var d2 = id.toString('hex', 11, 16);
//     fs.mkdirSync(raw_dir + d0 + '/' + d1 + '/' + d2);
// }
