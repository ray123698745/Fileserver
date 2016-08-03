/**
 * Created by cjfang on 7/7/16.
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

var url = 'http://localhost:3001/api/sequence/insertUnfiltered';

var server = app.listen(process.env.PORT || 3003, function () {
    log.debug("File server listening on port %s...", server.address().port);
});


function callPut(title, next30Sec) {

    log.debug("callPut");

    var unfilteredSequence = {
        title: title,
        capture_time: next30Sec.toISOString(),
        frame_number: 900,
        file_location: [{site: "us", root_path: "/vol1/" + title}, {site: "it", root_path: ""}],
        cameras: [
            {
                name: "Front_Stereo",
                is_stereo: true,
                annotate_request: []
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
    if (err) log.debug(err);

    if (!err) {

        log.debug(seqs);

        seqs.forEach(function(seq){
            // if (seq.charAt(0) == 'Z'){
            if (seq.charAt(0) == 'S'){


                var year = seq.substring(9, 13);
                var month = seq.substring(14, 16) -1;
                var date = seq.substring(17, 19);
                var hour = seq.substring(20, 22);
                var minute = seq.substring(23, 25);
                var second = seq.substring(26, 28);

                var mSec = Date.UTC(year, month, date, hour, minute, second);

                var frameNum = ls(newArrived + "L/" + seq + '/*.raw').length;
                // var frameNum = 2800;
                // var clipNum = parseInt(frameNum / 3);
                var clipNum = parseInt(frameNum / 900);


                log.debug("clipNum: " + clipNum);




                for (var i = 0; i < clipNum; i++) {


                    //** Parse title **//
                    var next30Sec = new Date(mSec);
                    var title = next30Sec.toISOString().replace('T', '-').substring(0, 19);
                    title = title.substring(2);
                    title = title.replace(/-/g, "");
                    title = title.replace(/:/g, "-");
                    title = title.slice(0, 6) + "-" + title.slice(6);
                    title = title + "-" + country;

                    log.debug('title: ' + title);



                    //** Generate h.264 clip & thumbnail **//
                    exec('ffmpeg -i ' + newArrived + 'L/' + seq + '/video_h264.mp4 -ss ' + i*30 + ' -t 30 ' + newArrived + 'L/' + seq + '/' + title + '_h264_L.mp4');
                    exec('ffmpeg -i ' + newArrived + 'R/' + seq + '/video_h264.mp4 -ss ' + i*30 + ' -t 30 ' + newArrived + 'R/' + seq + '/' + title + '_h264_R.mp4');

                    log.debug('H.264 generated!');
                    
                    exec('ffmpeg -i ' + newArrived + 'L/' + seq + '/' + title + '_h264_L.mp4 -ss 00:00:01.000 -vframes 1 -vf scale=-1:100 ' + newArrived + 'L/' + seq + '/temp_thumb.jpg');
                    exec('ffmpeg -i ' + newArrived + 'L/' + seq + '/temp_thumb.jpg -vframes 1 -vf crop=100:100 ' + newArrived + 'L/' + seq + '/thumb.jpg');
                    rm(newArrived + 'L/' + seq + '/temp_thumb.jpg');

                    log.debug('thumb generated!');

                    //** Setup sequence folder structure **//
                    mkdir('-p', seqRoot + title + '/Front_Stereo/L/raw');
                    mkdir('-p', seqRoot + title + '/Front_Stereo/R/raw');
                    mkdir('-p', seqRoot + title + '/Front_Stereo/L/yuv/temp');
                    mkdir('-p', seqRoot + title + '/Front_Stereo/R/yuv/temp');

                    cp('-r', newArrived + 'L/OtherSensor-Acq/OtherSensors-' + seq.substring(9, 25), seqRoot + title + '/' + title + '_Sensor');
                    mv(newArrived + 'L/' + seq + '/thumb.jpg', seqRoot + title + '/');
                    mv(newArrived + 'L/' + seq + '/' + title + '_h264_L.mp4', seqRoot + title + '/Front_Stereo/L/');
                    mv(newArrived + 'R/' + seq + '/' + title + '_h264_R.mp4', seqRoot + title + '/Front_Stereo/R/');



                    //for ( var j = 0; j < 3; j++){
                    for ( var j = 0; j < 900; j++){

                        var clipFrameNum = i * 900 + j;
                        //var clipFrameNum = i * 3 + j;
                        var frame = "" + clipFrameNum;
                        var pad = "0000000000";
                        var padFrame = pad.substring(0, pad.length - frame.length) + frame;

                        mv(newArrived + 'L/' + seq + '/buffer_' + padFrame + '.raw', seqRoot + title + '/Front_Stereo/L/raw/');
                        mv(newArrived + 'L/' + seq + '/md_ucode_' + padFrame + '.bin', seqRoot + title + '/Front_Stereo/L/raw/');
                        mv(newArrived + 'R/' + seq + '/buffer_' + padFrame + '.raw', seqRoot + title + '/Front_Stereo/R/raw/');
                        mv(newArrived + 'R/' + seq + '/md_ucode_' + padFrame + '.bin', seqRoot + title + '/Front_Stereo/R/raw/');
                    }



                    //** Insert to unfiltered DB collection **//

                    callPut(title, next30Sec);

                    mSec = mSec + 30000;

                    log.debug('Done: ' + title);

                }

                if ( (frameNum % 900) > 450 ){

                    // add remaining frame as seq
                }





            }
        });



    }
});



