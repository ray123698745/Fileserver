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
var seq = '/Users/rayfang/sequences/';
var failed = '/Users/rayfang/failed/';

var url = 'http://localhost:3000/api/sequence/insert';

const INTERVAL = 5000;

var server = app.listen(process.env.PORT || 3001, function () {
    log.debug("File server listening on port %s...", server.address().port);
});

setInterval(function() {

    log.debug('scan directory');
    fs.readdir(tmp, function(err, items) {
        if ( ! err && items.length > 0 ) {

            log.debug(items);

            for ( var i =  0; i < items.length; i++) {   // items.forEach(function(item){ ... });

                if (items[i].charAt(0) != '.'){   // exclude hidden directory


                    // fs.rename(tmp + items[i], seq + items[i], function (err) {
                    //     if(err)
                    //         log.error("rename error: " + err);
                    //     else
                    //         log.debug("rename success");
                    // })


                    /** add code to extract JSON file and create the metadata object **/


                    var sequence = {
                            
                        location: {country: "U.S.", state: "CA", city: "Santa clara"},
                        keywords: ["Sunny", "Urban", "Tunnel"],
                        gps: {x: -122.02301460000001, y: 37.2638324},
                        avg_speed: 60,
                        capture_time: "2016-05-30",
                        usage: "Training",
                        file_location: [{site: "U.S.", root_path: "/volumn1/SID1/"}, {site: "Parma", root_path: "/volumn2/SID1/"}],
                        yuv: [{yuv_id: "v1", desc: "more something"}, {yuv_id: "v2", desc: "less something"}],
                        annotation: {annotation_frame_rate: 30, objects: [{class: "Human", occurrence: 30}, {class: "Zombie", occurrence: 300}]},
                        
                        origin_path: items[i]  // should take this out!!
                    };


                    var options = {
                        url: url,
                        json: true,
                        body: sequence,
                        timeout: 1500
                    };


                    // should save dir before callback

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
                                log.debug('before rename dir: ', body.origin_path);

                                // rename folder by _id
                                fs.rename(tmp + body.origin_path, seq + body._id, function (err) {
                                    if(err){
                                        log.error("rename error: " + err);
                                        log.debug('dir: ', body.origin_path);
                                        // rollback database

                                    } else{
                                        log.debug("rename success");
                                        log.debug('dir: ', body.origin_path);
                                    }
                                      

                                })


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