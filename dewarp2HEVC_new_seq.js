/**
 * Created by cjfang on 1/16/17.
 */
/**
 * Created by cjfang on 8/22/16.
 */
const readline = require('readline');
const fs = require('fs');
// const ini = require('ini');

const GoogleMapsAPI = require('googlemaps');

const log4js = require('log4js');
log4js.configure('log_config.json', { reloadSecs: 300 });
const log = log4js.getLogger('dewarp2HEVC');
require('shelljs/global');
const express = require("express");
const bodyParser = require("body-parser");
const request = require('request');
const kue = require('kue');
// const queue = kue.createQueue();
const queue = kue.createQueue({
    redis: {
        port: 6379,
        host: '10.1.3.32'
    }
});
const app = express();
var url = 'http://localhost:3000/api/sequence/updateUnfiltered';
var queryUrl = 'http://10.1.3.32:3000/api/sequence/query';


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


var server = app.listen(process.env.PORT || 3021, function () {
    log.info("File server listening on port %s...", server.address().port);
});



// query = { version: 4,
//     no_annotation: false,
//     '$or':
//         [ { 'cameras.0.annotation': { '$elemMatch': { category: 'moving_object', state: 'Accepted' } } },
//             { 'cameras.0.annotation': { '$elemMatch': { category: 'moving_object', state: 'Finished' } } },
//             { 'cameras.0.annotation': { '$elemMatch': { category: 'moving_object', state: 'Finished_Basic' } } } ] };

query = { version: 4,
    capture_time:
    { '$gte': '2017-01-01T08:00:00.000Z',
        '$lte': '2017-01-15T08:00:00.000Z' },
    no_annotation: false };




var options = {
    url: queryUrl,
    json: true,
    body: query,
    timeout: 1000000
};

request.post(options, function(error, response, body) {
    // log.debug('update path response', response, 'body', body, 'error', error);
    // log.debug('body: ', body, 'error: ', error);

    if ( error ) {
        log.error('query DB failed', error);
    }
    else {
        if ( response.statusCode == 200 ) {
            log.debug('query success. Length:', body.length);

            // for (var i = 0; i < body.length; i++){
            for (var i = 0; i < body.length; i++){

                mv('/supercam/vol1/test_field/new_sequence/all_h265/' + body[i].title + '_h265_v1_R.mp4', '/supercam/vol1/test_field/new_sequence/all_h265/' + body[i].title + '_h264_v1_R.mp4');

                // var untar_job = queue.create('untar', {
                //     sequenceObj: body[i]
                // });
                //
                // untar_job.save();

            }

        }
        else {
            log.error('query failed', response.statusCode);
        }
    }
});


var queueSwitch = {
    untar: true,
    dewarp: true,
    cat: true,
    encode_HEVC: true
};


queue.process('untar', function (job, done){

    if(queueSwitch.untar){

        log.info("Processing untar: ", job.data.sequenceObj.title);
        log.info("Start: " + new Date());

        var seq = job.data.sequenceObj;

        var outputDir = '/supercam/vol1/test_field/new_sequence/' + seq.title + '/';

        mkdir('-p', outputDir + '/dewarp/');

        exec('tar -xf /supercam/vol1/' + seq.title + '/Front_Stereo/R/yuv/' + seq.title +  '_yuv_v1_R.tar -C ' + outputDir, {async:true}, function (code, stdout, stderr) {

            if (code == 0) {

                log.info('untar completed: ' + seq.title);

                mv(outputDir + seq.title + '_yuv_v1_R', outputDir + 'yuv');

                //** Copy annotation **//
                // var lastVersion = 1;
                // for (var i = 0; i < seq.cameras[0].annotation.length; i++){
                //     if(seq.cameras[0].annotation[i].category == 'moving_object'){
                //         lastVersion = seq.cameras[0].annotation[i].version.length;
                //     }
                // }

                // cp('/supercam/vol1/' + seq.title + '/Front_Stereo/annotation/moving_object_v' + lastVersion + '/' + seq.title + '_moving_object.json', outputDir);

                done(null, 'untar_done');

            } else {
                log.error("tar command failed. stderr: " + stderr);
            }
        });

    } else {
        done(null, 'untar_done');
    }

});


queue.process('dewarp', function (job, done){

    if(queueSwitch.dewarp){

        log.info("Processing dewarp: ", job.data.sequenceObj.title);
        log.info("Start: " + new Date());

        var seq = job.data.sequenceObj;

        var inputDir = '/supercam/vol1/test_field/new_sequence/' + seq.title + '/yuv/f_%010d.yuv';
        var outputDir = '/supercam/vol1/test_field/new_sequence/' + seq.title + '/dewarp/f_%010d.yuv';

        var cmd = 'dewarp-1.0.393 -i ' + inputDir + ' -o ' + outputDir+ ' -l /supercam/vol1/' + seq.title + '/Front_Stereo/R/cali_data/RECT_Right.blt -j 8';


        exec(cmd, {async:true}, function (code, stdout, stderr) {

            if (code == 0) {

                log.info('dewarp completed: ' + seq.title);

                rm('-r', '/supercam/vol1/test_field/new_sequence/' + seq.title + '/yuv');
                done(null, 'dewarp_done');


            } else {
                log.error("dewarp command failed. stderr: " + stderr);
            }
        });


    } else {
        done(null, 'dewarp_done');
    }

});


queue.process('cat', function (job, done){

    if(queueSwitch.cat){

        log.info("Processing cat: ", job.data.sequenceObj.title);
        log.info("Start: " + new Date());

        var seq = job.data.sequenceObj;

        var inputDir = '/supercam/vol1/test_field/new_sequence/' + seq.title + '/dewarp/*.yuv';
        var outputDir = '/supercam/vol1/test_field/new_sequence/' + seq.title + '/cat.yuv';
        var cmd = 'cat ' + inputDir + ' > ' + outputDir;


        exec(cmd, {async:true}, function (code, stdout, stderr) {

            if (code == 0) {

                log.info('cat completed: ' + seq.title);

                // rm('-r', '/supercam/vol1/test_field/new_sequence/' + seq.title + '/dewarp');
                done(null, 'cat_done');

            } else {
                log.error("cat command failed. stderr: " + stderr);
            }
        });

    } else {
        done(null, 'cat_done');
    }

});


queue.process('encode_HEVC', function (job, done){


    if(queueSwitch.encode_HEVC){

        log.info("Processing encode_HEVC: ", job.data.sequenceObj.title);
        log.info("Start: " + new Date());

        var seq = job.data.sequenceObj;

        var inputDir = '/supercam/vol1/test_field/new_sequence/' + seq.title + '/cat.yuv';
        var outputDir = '/supercam/vol1/test_field/new_sequence/all_h265/' + seq.title + '_h265_v1_R.mp4';



        var cmd = 'ffmpeg -f rawvideo -pix_fmt nv12 -s:v 3840x2160 -r 30 -i ' + inputDir + ' -c:v libx265 ' + outputDir;

        exec(cmd, {async:true}, function (code, stdout, stderr) {

            if (code == 0) {

                log.info('encode_HEVC completed: ' + seq.title);

                rm('-r', '/supercam/vol1/test_field/new_sequence/' + seq.title + '/cat.yuv');
                cp('/supercam/vol1/test_field/new_sequence/all_h265/' + seq.title + '_h265_v1_R.mp4', '/supercam/vol1/' + seq.title + '/Front_Stereo/R/yuv/' + seq.title + '_h265_v1_R.mp4');
                done(null, 'encode_HEVC_done');

            } else {
                log.error("encode_HEVC command failed. stderr: " + stderr);
            }
        });

    } else {
        done(null, 'encode_HEVC_done');
    }

});




queue.on('job enqueue', function(id, type){

    log.info('Job %s got queued of type %s', id, type );

}).on('job complete', function(id, result){

    if (result === 'untar_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;


            var dewarp_job = queue.create('dewarp', {
                sequenceObj: job.data.sequenceObj
            });

            dewarp_job.save();

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed untar job #%d', job.id);
            });

        });
    }

    if (result === 'dewarp_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;


            var cat_job = queue.create('cat', {
                sequenceObj: job.data.sequenceObj
            });

            cat_job.save();

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed dewarp job #%d', job.id);
            });

        });
    }

    if (result === 'cat_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;


            var encode_HEVC_job = queue.create('encode_HEVC', {
                sequenceObj: job.data.sequenceObj
            });

            encode_HEVC_job.save();

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed cat job #%d', job.id);
            });

        });
    }



    if (result === 'encode_HEVC_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;


            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed encode_HEVC job #%d', job.id);
            });
        });

    }


});
