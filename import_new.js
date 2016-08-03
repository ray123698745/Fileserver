/**
 * Created by cjfang on 7/25/16.
 */
var express = require("express");
var bodyParser = require("body-parser");
var log = require('log4js').getLogger('import');
var app = express();
var fs = require('fs');
var request = require('request');
var path = require('./config');
require('shelljs/global');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var newArrived = path.newArrived;
var seqRoot = path.seq;
var country = "it";

var url = 'http://localhost:3000/api/sequence/insertUnfiltered';
// var url = 'http://localhost:3001/api/sequence/insertUnfiltered';


var server = app.listen(process.env.PORT || 3003, function () {
    log.debug("File server listening on port %s...", server.address().port);
});


function callPut(title, captureTime, frameNum) {

    log.debug("callPut");

    var unfilteredSequence = {
        title: title,
        location: {country: "Italy", state: "Emilia-Romagna", city: "Parma"},
        keywords: [],
        gps: {x: 0, y: 0},
        avg_speed: 0,
        capture_time: captureTime,
        frame_number: frameNum,
        usage: "Training",
        file_location: [{site: "us", root_path: "/vol1/" + title}, {site: "it", root_path: ""}],
        cameras: [
            {
                name: "Front_Stereo",
                is_stereo: true,
                yuv: [],
                annotation: []
            }
        ]
    };


    var options = {
        url: url,
        json: true,
        body: unfilteredSequence,
        timeout: 1500
    };

    request.put(options, function(error, response, body) {
        // log.debug('import body: ', body, 'error: ', error);

        if ( error ) {
            log.error('Import DB put failed: ', error);
        }
        else {
            if ( response.statusCode == 200 ) {
                log.debug('Import DB success: ', body);
            }
            else {
                log.error('Import DB response failed, response.statusCode: ', response.statusCode);
            }
        }
    });
}



log.debug('scan directory');
fs.readdir(newArrived + "L/", function(err, seqs) {
    if (err){
        log.debug(err);
    } else {
        log.debug(seqs);

        seqs.forEach(function(seq){
            // if (seq.charAt(0) == 'Z'){
            if (seq.charAt(0) == 'S'){


                var captureTime = seq.substring(9);
                var frameNum = ls(newArrived + "L/" + seq + '/*.raw').length;

                //** Parse title **//
                var title = seq.substring(11);
                title = title.replace(/:/g, "");
                title = title + "-" + country;

                log.debug('title: ' + title);



                // Generate thumbnail //
                exec('ffmpeg -i ' + newArrived + 'L/' + seq + '/video_h264.mp4 -ss 00:00:03.000 -vframes 1 -vf scale=-1:100 ' + newArrived + 'L/' + seq + '/temp_thumb.jpg');
                exec('ffmpeg -i ' + newArrived + 'L/' + seq + '/temp_thumb.jpg -vframes 1 -vf crop=100:100 ' + newArrived + 'L/' + seq + '/thumb.jpg');
                rm(newArrived + 'L/' + seq + '/temp_thumb.jpg');

                log.debug('thumb generated!');


                // Setup sequence folder structure //
                mkdir('-p', seqRoot + title + '/Front_Stereo/L/raw');
                mkdir('-p', seqRoot + title + '/Front_Stereo/R/raw');
                mkdir('-p', seqRoot + title + '/Front_Stereo/L/yuv/temp');
                mkdir('-p', seqRoot + title + '/Front_Stereo/R/yuv/temp');
                mkdir('-p', seqRoot + title + '/Front_Stereo/annotation');

                // cp('-r', newArrived + 'L/OtherSensor-Acq/OtherSensors-' + seq.substring(9, 25), seqRoot + title + '/' + title + '_Sensor');
                mv(newArrived + 'L/' + seq + '/thumb.jpg', seqRoot + title + '/');
                mv(newArrived + 'L/' + seq + '/video_h264.mp4', seqRoot + title + '/Front_Stereo/L/' + title + '_h264_L.mp4');
                mv(newArrived + 'R/' + seq + '/video_h264.mp4', seqRoot + title + '/Front_Stereo/R/' + title + '_h264_R.mp4');


                mv(newArrived + 'L/' + seq + '/*', seqRoot + title + '/Front_Stereo/L/raw/');
                mv(newArrived + 'R/' + seq + '/*', seqRoot + title + '/Front_Stereo/R/raw/');


                // Insert to unfiltered DB collection //

                callPut(title, captureTime,frameNum);

                log.debug('Done: ' + title);


            }

        });
    }

});



