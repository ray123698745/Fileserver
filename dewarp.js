var importSwitch = {
    dewarp: true
};

const kue = require('kue');
const queue = kue.createQueue({
    redis: {
        port: 6379,
        host: '10.1.3.32'
    }
});

// const express = require("express");
// const bodyParser = require("body-parser");
// const app = express();
//
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
const request = require('request');

const fs = require('fs');
const config = require('./config');
const readline = require('readline');
require('shelljs/global');
var volume = config.volume;

var log_config = (volume === 'vol1' || volume === 'vol2') ? './log_config_1.json' :'./log_config_3.json';

const log4js = require('log4js');
log4js.configure(require(log_config).dewarp);
const log = log4js.getLogger('dewarp');
const SITE = 'us';
var insertURL = config.insertURL;

var dewarp_job = (volume === 'vol1' || volume === 'vol2') ? 'dewarp_job_1' :'dewarp_job_3';
var dewarp_job_done = (volume === 'vol1' || volume === 'vol2') ? 'dewarp_job_1_done' :'dewarp_job_3_done';
var cat_job = (volume === 'vol1' || volume === 'vol2') ? 'cat_job_1' :'cat_job_3';

var getRootPathBySite = function (siteArray) {

    for (var i=0; i < siteArray.length; i++) {
        if (siteArray[i].site === SITE) {
            return siteArray[i].root_path;
        }
    }
};

queue.process(dewarp_job, function (job, done){

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
            cmd = './dewarp-1.0.393 -i ' + inputDir + 'f_%010d.yuv -o ' + outputDir+ 'f_%010d.yuv -l /supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/cali_data/RECT_Left.blt -j 8';
            mkdir('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/dewarp');

        } else {
            inputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/' + seq.title + '_yuv_v' + versionNum + '_R/';
            outputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/dewarp/';
            cmd = './dewarp-1.0.393 -i ' + inputDir + 'f_%010d.yuv -o ' + outputDir + 'f_%010d.yuv -l /supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/cali_data/RECT_Right.blt -j 8';
            mkdir('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/dewarp');
        }

        exec(cmd, {async:true}, function (code, stdout, stderr) {

            if (code == 0) {

                log.info('dewarp completed: ' + seq.title + ' ' + job.data.channel);

                rm('-r', inputDir);
                mv(outputDir, inputDir);

                var cat = queue.create(cat_job, {
                    sequenceObj: job.data.sequenceObj,
                    channel: job.data.channel,
                    ituner: job.data.ituner,
                    versionNum: job.data.versionNum,
                    batchAnnCount: job.data.batchAnnCount,
                    annRemains: job.data.annRemains,
                    curSeqCount: job.data.curSeqCount
                });

                cat.save();

                done(null, dewarp_job_done);


            } else {
                log.error("dewarp command failed. stderr: " + stderr);
            }
        });


    } else {
        var cat = queue.create(cat_job, {
            sequenceObj: job.data.sequenceObj,
            channel: job.data.channel,
            ituner: job.data.ituner,
            versionNum: job.data.versionNum,
            batchAnnCount: job.data.batchAnnCount,
            annRemains: job.data.annRemains,
            curSeqCount: job.data.curSeqCount
        });

        cat.save();
        done(null, dewarp_job_done);
    }

});

