var importSwitch = {
    dewarp: true,
    cat: true,
    encode_HEVC: true,
    genPreviewImg: true
};

const kue = require('kue');
const queue = kue.createQueue({
    redis: {
        port: 6379,
        host: '10.1.3.32'
    }
});

const express = require("express");
const bodyParser = require("body-parser");
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const request = require('request');
const log4js = require('log4js');
log4js.configure(require('./log_config.json').dewarp2HEVC);
const log = log4js.getLogger('dewarp2HEVC');
const fs = require('fs');
const config = require('./config');
const readline = require('readline');
require('shelljs/global');

const SITE = 'us';
var insertURL = config.insertURL;

var server = app.listen(process.env.PORT || 3005, function () {
    log.info("File server listening on port %s...", server.address().port);
});


var getRootPathBySite = function (siteArray) {

    for (var i=0; i < siteArray.length; i++) {
        if (siteArray[i].site === SITE) {
            return siteArray[i].root_path;
        }
    }
};

queue.process('dewarp', function (job, done){

    if(importSwitch.dewarp){

        log.info("Processing dewarp: ", job.data.sequenceObj.title, job.data.channel);
        log.info("Start: " + new Date());

        var seq = job.data.sequenceObj;
        var channel = job.data.channel;
        var versionNum = job.data.versionNum;


        var cmd = '';
        var inputDir = '';
        var outputDir = '';

        if (channel == 'left'){

            inputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/' + seq.title + '_yuv_v' + versionNum + '_L/';
            outputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/dewarp/';
            cmd = 'dewarp-1.0.393 -i ' + inputDir + 'f_%010d.yuv -o ' + outputDir+ 'f_%010d.yuv -l /supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/cali_data/RECT_Left.blt -j 8';
            mkdir('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/dewarp');

        } else {
            inputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/' + seq.title + '_yuv_v' + versionNum + '_R/';
            outputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/dewarp/';
            cmd = 'dewarp-1.0.393 -i ' + inputDir + 'f_%010d.yuv -o ' + outputDir + 'f_%010d.yuv -l /supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/cali_data/RECT_Right.blt -j 8';
            mkdir('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/dewarp');
        }

        exec(cmd, {async:true}, function (code, stdout, stderr) {

            if (code == 0) {

                log.info('dewarp completed: ' + seq.title + ' ' + job.data.channel);

                rm('-r', inputDir);
                mv(outputDir, inputDir);

                var cat_job = queue.create('cat', {
                    sequenceObj: job.data.sequenceObj,
                    channel: job.data.channel,
                    ituner: job.data.ituner,
                    versionNum: job.data.versionNum,
                    batchAnnCount: job.data.batchAnnCount,
                    annRemains: job.data.annRemains,
                    curSeqCount: job.data.curSeqCount
                });

                cat_job.save();

                done(null, 'dewarp_done');


            } else {
                log.error("dewarp command failed. stderr: " + stderr);
            }
        });


    } else {
        var cat_job = queue.create('cat', {
            sequenceObj: job.data.sequenceObj,
            channel: job.data.channel,
            ituner: job.data.ituner,
            versionNum: job.data.versionNum,
            batchAnnCount: job.data.batchAnnCount,
            annRemains: job.data.annRemains,
            curSeqCount: job.data.curSeqCount
        });

        cat_job.save();
        done(null, 'dewarp_done');
    }

});


queue.process('cat', function (job, done){

    if(importSwitch.cat){

        log.info("Processing cat: ", job.data.sequenceObj.title, job.data.channel);
        log.info("Start: " + new Date());

        var seq = job.data.sequenceObj;
        var channel = job.data.channel;
        var versionNum = job.data.versionNum;
        var cmd = '';

        var inputDir = '';

        if (channel == 'left'){
            inputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/' + seq.title + '_yuv_v' + versionNum + '_L/*.yuv';
            cmd = 'cat ' + inputDir + ' > ' + '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/cat.yuv';

        } else {
            inputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/' + seq.title + '_yuv_v' + versionNum + '_R/*.yuv';
            cmd = 'cat ' + inputDir + ' > ' + '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/cat.yuv';
        }

        exec(cmd, {async:true}, function (code, stdout, stderr) {

            if (code == 0) {

                log.info('cat completed: ' + seq.title + ' ' + job.data.channel);

                var encode_HEVC_job = queue.create('encode_HEVC', {
                    sequenceObj: job.data.sequenceObj,
                    channel: job.data.channel,
                    ituner: job.data.ituner,
                    versionNum: job.data.versionNum,
                    batchAnnCount: job.data.batchAnnCount,
                    annRemains: job.data.annRemains,
                    curSeqCount: job.data.curSeqCount
                });

                encode_HEVC_job.save();

                done(null, 'cat_done');

            } else {
                log.error("cat command failed. stderr: " + stderr);
            }
        });

    } else {
        var encode_HEVC_job = queue.create('encode_HEVC', {
            sequenceObj: job.data.sequenceObj,
            channel: job.data.channel,
            ituner: job.data.ituner,
            versionNum: job.data.versionNum,
            batchAnnCount: job.data.batchAnnCount,
            annRemains: job.data.annRemains,
            curSeqCount: job.data.curSeqCount
        });

        encode_HEVC_job.save();
        done(null, 'cat_done');
    }

});


queue.process('encode_HEVC', function (job, done){

    log.info("Processing encode_HEVC: ", job.data.sequenceObj.title, job.data.channel);
    log.info("Start: " + new Date());

    var seq = job.data.sequenceObj;
    var channel = job.data.channel;
    var versionNum = job.data.versionNum;
    var ituner = job.data.ituner;

    if(importSwitch.encode_HEVC){



        var inputDir = '';

        if (channel == 'left'){
            inputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/cat.yuv';
            outputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/' + seq.title + '_h265_v' + versionNum + '_L.mp4';

        } else {
            inputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/cat.yuv';
            outputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/' + seq.title + '_h265_v' + versionNum + '_R.mp4';
        }

        var cmd = 'ffmpeg -f rawvideo -pix_fmt nv12 -s:v 3840x2160 -r 30 -y -i ' + inputDir + ' -c:v libx265 ' + outputDir;

        exec(cmd, {async:true}, function (code, stdout, stderr) {

            if (code == 0) {

                log.info('encode_HEVC completed: ' + seq.title + ' ' + job.data.channel);

                rm(inputDir);

                if (job.data.channel == 'right'){

                    seq.cameras[0].yuv.push({
                        version: versionNum,
                        desc: ituner
                    });

                    var genPreviewImg = queue.create('genPreviewImg', {
                        sequenceObj: seq,
                        batchAnnCount: job.data.batchAnnCount,
                        annRemains: job.data.annRemains,
                        curSeqCount: job.data.curSeqCount
                    });

                    genPreviewImg.save();
                }


                done(null, 'encode_HEVC_done');

            } else {
                log.error("encode_HEVC command failed. stderr: " + stderr);
            }
        });

    } else {
        if (job.data.channel == 'right'){

            seq.cameras[0].yuv.push({
                version: versionNum,
                desc: ituner
            });

            var genPreviewImg = queue.create('genPreviewImg', {
                sequenceObj: seq,
                batchAnnCount: job.data.batchAnnCount,
                annRemains: job.data.annRemains,
                curSeqCount: job.data.curSeqCount
            });

            genPreviewImg.save();
        }

        done(null, 'encode_HEVC_done');
    }

});


queue.process('genPreviewImg', function (job, done){

    log.info("Processing genPreviewImg: ", job.data.sequenceObj.title);
    log.info("Start: " + new Date());
    var seq = job.data.sequenceObj;


    if(importSwitch.genPreviewImg){

        var inputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/' + seq.title + '_h265_v1_R.mp4';
        var outputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/preview_img/f_%010d.jpg';

        mkdir('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/preview_img/');
        var cmd = 'ffmpeg -i ' + inputDir + ' -qscale:v 1 -start_number 0 ' + outputDir;

        exec(cmd, {async:true}, function (code, stdout, stderr) {

            if (code == 0) {

                log.info('genPreviewImg completed: ' + seq.title);

                var options = {
                    url: insertURL,
                    json: true,
                    body: seq,
                    timeout: 1000000
                };

                request.post(options, function(error, response, body) {
                    // log.debug('update path response', response, 'body', body, 'error', error);
                    // log.debug('body: ', body, 'error: ', error);

                    if ( error ) {
                        log.error('Insert DB failed', error);
                    }
                    else {
                        if ( response.statusCode == 200 ) {
                            log.debug('Insert success', body);
                            done(null, 'genPreviewImg_done');
                        }
                        else {
                            log.error('Insert failed', response.statusCode);
                        }
                    }
                });

                var genAnnotation = queue.create('genAnnotation', {
                    sequenceObj: seq,
                    batchAnnCount: job.data.batchAnnCount,
                    annRemains: job.data.annRemains,
                    curSeqCount: job.data.curSeqCount
                });

                // genAnnotation.save(); // Todo: uncomment!
                // done(null, 'genPreviewImg_done');


            } else {
                log.error("genPreviewImg command failed. stderr: " + stderr);
            }
        });

    } else {

        var genAnnotation = queue.create('genAnnotation', {
            sequenceObj: seq,
            batchAnnCount: job.data.batchAnnCount,
            annRemains: job.data.annRemains,
            curSeqCount: job.data.curSeqCount
        });

        genAnnotation.save();

        done(null, 'genPreviewImg_done');
    }

});
