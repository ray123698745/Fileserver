/**
 * Created by cjfang on 1/25/17.
 */
var switchEncode = true;

const kue = require('kue');
const queue = kue.createQueue({
    redis: {
        port: 6379,
        host: '10.1.3.32'
    }
});
const spawn = require('child_process').spawn;

const fs = require('fs');
require('shelljs/global');
const telnet = require('telnet-client');
const config = require('./config');
var volume = config.volume;
var log_config = (volume === 'vol1' || volume === 'vol2') ? './log_config_1.json' :'./log_config_3.json';

const log4js = require('log4js');
log4js.configure(require(log_config).EVK_encode);
const log = log4js.getLogger('EVK_encode');

const EVKNUM = 5;

var encode_job = (volume === 'vol1' || volume === 'vol2') ? 'encode_job_1' :'encode_job_3';
var encode_job_done = (volume === 'vol1' || volume === 'vol2') ? 'encode_job_1_done' :'encode_job_3_done';
var dewarp_job = (volume === 'vol1' || volume === 'vol2') ? 'dewarp_job_1' :'dewarp_job_3';

var ip = (volume === 'vol1' || volume === 'vol2') ? 10 : 15;




const SITE = 'us';

var title = "";
var doneChannelCount = 0;

var getRootPathBySite = function (siteArray) {

    for (var i=0; i < siteArray.length; i++) {
        if (siteArray[i].site === SITE) {
            return siteArray[i].root_path;
        }
    }
};


queue.process(encode_job, function (job, done){

    log.info('Processing encode ' + job.data.sequenceObj.title + ' ' + job.data.channel);
    log.info("Start: " + new Date());

    var seq = job.data.sequenceObj;
    var isInitEncode = job.data.isInitEncode;
    var channel = job.data.channel;
    var versionNum = 1;
    var ituner = 'day_compressed_stronge_CE_LV1.txt';

    if (switchEncode){


        var inputPath = '';
        var outputPath = '';
        var serverOutputPath = '';
        var yuvPath = '';
        var channelAbr = '';

        if (channel == 'left'){
            // var inputPath = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/raw';
            // var outputPath = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/temp/';
            inputPath = '/mnt/ssd_1/' + seq.title + '/Front_Stereo/L/raw';
            outputPath = '/mnt/ssd_1/' + seq.title + '/Front_Stereo/L/yuv/temp/';
            serverOutputPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/temp/';
            yuvPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/';
            channelAbr = 'L';

        } else {
            // var inputPath = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/raw';
            // var outputPath = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/temp/';
            inputPath = '/mnt/ssd_1/' + seq.title + '/Front_Stereo/R/raw';
            outputPath = '/mnt/ssd_1/' + seq.title + '/Front_Stereo/R/yuv/temp/';
            serverOutputPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/temp/';
            yuvPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/';
            channelAbr = 'R';
        }

        // rm('-r','/supercam/vol2/' + seq.title + '/Front_Stereo/' + channelAbr + '/yuv/*');

        // var frameNum = seq.frame_number;
        var frameNum = 900;
        var divideFrame = parseInt(frameNum / EVKNUM);
        var startFrame = 0;
        var doneCount = 0;
        var itunerPath = "/home/amba/ini/";
        var serverItunerPath = "/supercam/vol1/ini/";
        var local_ip = ip;
        // log.debug("frameNum: ",frameNum);
        // log.debug("divideFrame: ",divideFrame);


        mkdir(serverOutputPath);

        // Set ituner & version number
        if (isInitEncode) {

            versionNum = 1;


            for (var i = 0; i < seq.keywords.length; i++) {

                // if (seq.keywords[i] == 'Back_lit') {
                //     ituner = '20161127_daytime_contrast.ini';
                //     break;
                // }

                if (seq.keywords[i] == 'Night_with_street_light' || seq.keywords[i] == 'Night_without_street_light') {
                    ituner = 'night_compressed_sharp_LV1_stronge_CE_LV1_dgain.txt';
                    break;
                }

                // if (seq.keywords[i] == 'Dawn' || seq.keywords[i] == 'Dusk') {
                //     ituner = 'dawn_compressed_sharp_LV1_stronge_CE_LV1.txt';
                //     break;
                // }

                // Default ituner if no keyword match
                ituner = 'day_compressed_stronge_CE_LV1.txt';
            }



        } else {

            versionNum = 0;

            seq.cameras[0].yuv.forEach(function (yuvVersion) {
                if (yuvVersion.version > versionNum) versionNum = yuvVersion.version;
            });

            versionNum++;
            ituner = job.data.ituner;
        }

        itunerPath += ituner;
        serverItunerPath += ituner;

        // Raw encode loop
        for (var i = 0; i < EVKNUM ; i++) {

            if (i == EVKNUM - 1)
                divideFrame = divideFrame + (frameNum % EVKNUM);

            // Todo: change cmd to ./raw_encode.sh
            var cmd = './raw_encode_check.sh /mnt/ssd_1;sleep 1; test_ituner -l ' + itunerPath + ' -g 0;sleep 3;./raw_encode.sh ' + inputPath + ' ' + outputPath + ' ' + startFrame + ' ' + divideFrame + ' 1 0 0';



            var child = spawn('ruby', ['telnet.rb', cmd, '192.168.240.' + local_ip]);

            // child.stdout.on('data',
            //     function (data) {
            //         log.debug('stdout: ' + data);
            //     }
            // );

            child.stderr.on('data',
                function (data) {
                    log.error('encode process stderr: ' + data);
                }
            );

            child.on('exit', function (exitCode) {
                log.info("Child exited with code: " + exitCode);

                if (exitCode === 0) {

                    doneCount++;

                    if (doneCount == EVKNUM ) {

                        log.info("End: " + new Date());


                        var yuvFile = seq.title + '_yuv_v' + versionNum + '_' + channelAbr;

                        cp(serverItunerPath, serverOutputPath);
                        mv(serverOutputPath, yuvPath + yuvFile);

                        if (title == ""){
                            title = seq.title;
                            doneChannelCount++;
                        } else {

                            if (title == seq.title){
                                doneChannelCount++;
                            } else {
                                title = seq.title;
                                doneChannelCount = 1;
                            }
                        }

                        // var updateDB = false;
                        // if (doneChannelCount != 0 && doneChannelCount%2 == 0){
                        //
                        //     var query = {
                        //         condition: {title: seq.title},
                        //         update: {$push: {
                        //             "cameras.0.yuv": {
                        //                 "version": versionNum,
                        //                 "desc": ituner
                        //             }
                        //         }},
                        //         options: {multi: false}
                        //     };
                        //
                        //
                        //     log.info('update DB: ' + query.condition.title);
                        //
                        //     var options = {
                        //         url: updateURL,
                        //         json: true,
                        //         body: query,
                        //         timeout: 1000000
                        //     };
                        //
                        //     request.post(options, function(error, response, body) {
                        //
                        //         if ( error ) {
                        //             log.error('Update DB failed', error);
                        //
                        //         } else {
                        //             if ( response.statusCode == 200 ) {
                        //                 log.info('Update success', body);
                        //             }
                        //             else {
                        //                 log.error('Update failed', response.statusCode);
                        //             }
                        //         }
                        //     });
                        //
                        //     // updateDB = true;
                        // }

                        var dewarp = queue.create(dewarp_job, {
                            sequenceObj: seq,
                            channel: channel,
                            ituner: ituner,
                            versionNum: versionNum,
                            batchAnnCount: job.data.batchAnnCount,
                            annRemains: job.data.annRemains,
                            curSeqCount: job.data.curSeqCount
                        });

                        dewarp.save();

                        // var tar_yuv_job = queue.create('tar_yuv', {
                        //     yuvPath: yuvPath,
                        //     yuvFile: yuvFile,
                        //     updateDB: updateDB,
                        //     query: query
                        // });
                        //
                        // tar_yuv_job.save();

                        done(null, encode_job_done);
                    }
                } else {
                    log.error("encode failed with code: " + exitCode);

                }

            });

            startFrame = startFrame + divideFrame;
            local_ip++;
        }
    } else {

        var dewarp = queue.create(dewarp_job, {
            sequenceObj: seq,
            channel: channel,
            ituner: ituner,
            versionNum: versionNum,
            batchAnnCount: job.data.batchAnnCount,
            annRemains: job.data.annRemains,
            curSeqCount: job.data.curSeqCount
        });

        dewarp.save();

        done(null, encode_job_done);
    }


});
