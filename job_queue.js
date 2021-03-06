/**
 * Created by rayfang on 6/27/16.
 */
var queueSwitch = {
    decompress: false,
    dewarp: false,
    cat: false,
    encode_HEVC: false,
    genAnnotation: true
};


const kue = require('kue');
// const queue = kue.createQueue();
const queue = kue.createQueue({
    redis: {
        port: 6379,
        host: '10.1.3.32'
    }
});
const spawn = require('child_process').spawn;
const log4js = require('log4js');
log4js.configure('log_config.json', { reloadSecs: 300 });
const log = log4js.getLogger('job_queue');
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const fs = require('fs');
const request = require('request');
require('shelljs/global');
const telnet = require('telnet-client');
// var connection = new telnet();
var insertURL = 'http://10.1.3.32:3001/api/sequence/insert';
var updateURL = 'http://10.1.3.32:3001/api/sequence/update';
var batchURL = 'http://10.1.3.32:3001/api/annotation/insertBatch';




app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


var server = app.listen(process.env.PORT || 3004, function () {
    log.info("File server listening on port %s...", server.address().port);
});



const EVKNUM = 10;
const THREADS = 2;
const SITE = 'us';

var templatePath = "/supercam/vol1/annotation/annotation_template/";
var batchPath = "/supercam/vol1/annotation/tasks_batch/temp/";
var sequence_ini_template = fs.readFileSync(templatePath + 'sequence.ini', 'utf-8');
var sequence_mef_template = fs.readFileSync(templatePath + 'sequence.mef', 'utf-8');
var session_template = fs.readFileSync(templatePath + 'sessions.ini', 'utf-8');
var currentPath = pwd();

var title = "";
var doneChannelCount = 0;
var priority_text = {
    "Vehicle": "",
    "Pedestrian": "",
    "Road": "",
    "Road-with-curb": "",
    "Lane": ""
};

var getRootPathBySite = function (siteArray) {

    for (var i=0; i < siteArray.length; i++) {
        if (siteArray[i].site === SITE) {
            return siteArray[i].root_path;
        }
    }
};


var convert_ini = function (cali_ini) {

    var cali_ini_1 = cali_ini.substring(0, cali_ini.search('OPTICAL CENTER') + 17);

    var sub_cali_ini = cali_ini.substring(cali_ini.search('OPTICAL CENTER') + 17);
    var opticalCenterX = sub_cali_ini.substring(0, sub_cali_ini.search(','));

    sub_cali_ini = sub_cali_ini.substring(sub_cali_ini.search(',')+2);
    var opticalCenterY = sub_cali_ini.substring(0, sub_cali_ini.search('\t'));
    var cali_ini_2 = sub_cali_ini.substring(sub_cali_ini.search('\t'), sub_cali_ini.search('PIXEL FOCAL LENGTH'));

    sub_cali_ini = sub_cali_ini.substring(sub_cali_ini.search('PIXEL FOCAL LENGTH')+21);
    var focalLengthX = sub_cali_ini.substring(0, sub_cali_ini.search(','));

    sub_cali_ini = sub_cali_ini.substring(sub_cali_ini.search(',')+2);
    var focalLengthY = sub_cali_ini.substring(0, sub_cali_ini.search('\t'));
    var cali_ini_3 = sub_cali_ini.substring(sub_cali_ini.search('\t'));

    return cali_ini_1 + opticalCenterX/2 + ', ' + opticalCenterY/2 + cali_ini_2 + 'PIXEL FOCAL LENGTH = ' + focalLengthX/2 + ', ' + focalLengthY/2 + cali_ini_3;
};


var genTask = function (task, seq, annotationPath, h265, request) {

    var taskPath = annotationPath + seq.title + '_' + task + '/';

    mkdir(taskPath);

    cp(templatePath + 'Classes.ini', taskPath);

    var Annotate_ini = fs.readFileSync(templatePath + 'Annotate_' + task + '.ini', 'utf-8');
    Annotate_ini = Annotate_ini.replace('@json', seq.title + '_' + request.category); // Todo: edit json file name


    var cali_right_ini = fs.readFileSync('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/cali_data/Right.ini', 'utf-8');
    var cali_left_ini = fs.readFileSync('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/cali_data/Left.ini', 'utf-8');


    var sequence_ini = sequence_ini_template;
    sequence_ini = sequence_ini.replace('@rightFile', h265);
    // sequence_ini = sequence_ini.replace('@rightCali', convert_ini(cali_right_ini));
    sequence_ini = sequence_ini.replace('@rightCali', cali_right_ini);

    // sequence_ini = sequence_ini.replace('@rightRECT', '$INPUT_DIR/RECT_Right.blt');
    // sequence_ini = sequence_ini.replace('@leftCali', convert_ini(cali_left_ini));
    sequence_ini = sequence_ini.replace('@leftCali', cali_left_ini);
    // sequence_ini = sequence_ini.replace('@leftRECT', '$INPUT_DIR/RECT_Left.blt');


    var sequence_mef = sequence_mef_template.replace('@file', h265);
    sequence_mef = sequence_mef.replace('@rate', 30/request.fps);


    var session = session_template.replace(/@path/g, seq.title + '_' + task);


    priority_text[task] = priority_text[task] + seq.title + '_' + task + ' ' + request.priority + ' ' + request.fps + '\n';


    fs.writeFileSync(taskPath + 'Annotate.ini', Annotate_ini, 'utf-8');
    fs.writeFileSync(taskPath + seq.title + '_' + task + '.ini', sequence_ini, 'utf-8');
    fs.writeFileSync(taskPath + seq.title + '_' + task  + '.mef', sequence_mef, 'utf-8');
    fs.writeFileSync(taskPath + 'sessions.ini', session, 'utf-8');

};

queue.process('decompress', function (job, done){


    log.info("Processing decompress: ", job.data.sequenceObj.title);
    log.info("Start: " + new Date());

    if (queueSwitch.decompress){
        var seq = job.data.sequenceObj;
        var frameNum = seq.frame_number;
        var rightRawDir = '/mnt/supercam/' + seq.title + '/Front_Stereo/R/raw';
        var leftRawDir = '/mnt/supercam/' + seq.title + '/Front_Stereo/L/raw';
        var divideFrame = parseInt(frameNum / THREADS);
        var startFrame = 0;
        var endFrame = divideFrame;
        var doneCount = 0;



        // Todo: Change mount point on algo3 to be consistent with web server
        // var rightRawDir = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/raw';
        // var leftRawDir = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/raw';


        for (var i = 0; i < THREADS; i++){

            if (i === THREADS-1)
                endFrame = endFrame + (frameNum % THREADS);

            var decompressRight = spawn('./decompress/decompress.sh', [rightRawDir, rightRawDir, startFrame, endFrame-1]);
            var decompressLeft = spawn('./decompress/decompress.sh', [leftRawDir, leftRawDir, startFrame, endFrame-1]);


            decompressRight.stderr.on('data',
                function (data) {
                    log.error('right stderr: ' + data);
                }
            );

            decompressLeft.stderr.on('data',
                function (data) {
                    log.error('left stderr: ' + data);
                }
            );

            decompressRight.on('exit', function (exitCode) {
                // log.debug(" Right child exited with code: " + exitCode);

                if (exitCode === 0){

                    // log.debug("Done decompress Right, doneCount: " + doneCount);
                    doneCount++;

                    if (doneCount == THREADS*2){
                        log.info("Done decompress sequence: " + seq.title);
                        log.info("End: " + new Date());

                        done(null, 'decompress_done');
                    }
                } else {
                    log.error("decompress sequence " + seq.title + ' failed. Exit code: ' + exitCode);
                }
            });

            decompressLeft.on('exit', function (exitCode) {
                // log.debug("Left child exited with code: " + exitCode);

                if (exitCode === 0){

                    // log.debug("Done decompress Left, doneCount: " + doneCount);
                    doneCount++;

                    if (doneCount == THREADS*2){
                        log.info("Done decompress sequence: " + seq.title);
                        done(null, 'decompress_done');
                    }
                } else {
                    log.error("decompress sequence " + seq.title + ' failed. Exit code: ' + exitCode);
                }
            });

            startFrame = startFrame + divideFrame;
            endFrame = endFrame + divideFrame;

        }

    } else {
        done(null, 'decompress_done');
    }

});


// queue.process('encode', function (job, done){
//
//     log.info('Processing encode ' + job.data.sequenceObj.title + ' ' + job.data.channel);
//     log.info("Start: " + new Date());
//
//
//     var seq = job.data.sequenceObj;
//     var isInitEncode = job.data.isInitEncode;
//     var channel = job.data.channel;
//
//     var inputPath = '';
//     var outputPath = '';
//     var serverOutputPath = '';
//     var yuvPath = '';
//     var channelAbr = '';
//     var versionNum = 0;
//
//     if (channel == 'left'){
//         // var inputPath = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/raw';
//         // var outputPath = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/temp/';
//         inputPath = '/mnt/ssd_1/' + seq.title + '/Front_Stereo/L/raw';
//         outputPath = '/mnt/ssd_1/' + seq.title + '/Front_Stereo/L/yuv/temp/';
//         serverOutputPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/temp/';
//         yuvPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/';
//         channelAbr = 'L';
//
//     } else {
//         // var inputPath = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/raw';
//         // var outputPath = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/temp/';
//         inputPath = '/mnt/ssd_1/' + seq.title + '/Front_Stereo/R/raw';
//         outputPath = '/mnt/ssd_1/' + seq.title + '/Front_Stereo/R/yuv/temp/';
//         serverOutputPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/temp/';
//         yuvPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/';
//         channelAbr = 'R';
//     }
//
//
//     // var frameNum = seq.frame_number;
//     var frameNum = 900; //Todo: Testing
//     var divideFrame = parseInt(frameNum / EVKNUM);
//     var startFrame = 0;
//     var doneCount = 0;
//     var ip = 10;
//     var ituner = "";
//     var itunerPath = "/home/amba/ini/";
//     var serverItunerPath = "/supercam/vol1/ini/";
//
//
//     mkdir(serverOutputPath);
//
//     // Set ituner & version number
//     if (isInitEncode) {
//
//         versionNum = 1;
//
//         if (seq.keywords.length == 0) {
//             // Default ituner if no keyword match
//             ituner = 'day_compressed_stronge_CE_LV1.txt';
//         } else {
//             for (var i = 0; i < seq.keywords.length; i++) {
//
//                 // if (seq.keywords[i] == 'Back_lit') {
//                 //     ituner = '20161127_daytime_contrast.ini';
//                 //     break;
//                 // }
//
//                 if (seq.keywords[i] == 'Night_with_street_light' || seq.keywords[i] == 'Night_without_street_light') {
//                     ituner = 'night_compressed_stronge_CE_LV1.txt';
//                     break;
//                 }
//
//                 // Default ituner if no keyword match
//                 ituner = 'day_compressed_stronge_CE_LV1.txt';
//             }
//         }
//
//
//     } else {
//
//         versionNum = 0;
//
//         seq.cameras[0].yuv.forEach(function (yuvVersion) {
//             if (yuvVersion.version > versionNum) versionNum = yuvVersion.version;
//         });
//
//         versionNum++;
//         ituner = job.data.ituner;
//     }
//
//     itunerPath += ituner;
//     serverItunerPath += ituner;
//
//     // Raw encode loop
//     for (var i = 0; i < EVKNUM ; i++) {
//
//         if (i == EVKNUM - 1)
//             divideFrame = divideFrame + (frameNum % EVKNUM);
//
//         // Todo: change cmd to ./raw_encode.sh
//         var cmd = './raw_encode_check.sh /mnt/ssd_1;sleep 1; test_ituner -l ' + itunerPath + ' -g 0;sleep 3;./raw_encode.sh ' + inputPath + ' ' + outputPath + ' ' + startFrame + ' ' + divideFrame + ' 1 1 0';
//
//
//
//         var child = spawn('ruby', ['telnet.rb', cmd, '192.168.240.' + ip]);
//
//         // child.stdout.on('data',
//         //     function (data) {
//         //         log.debug('stdout: ' + data);
//         //     }
//         // );
//
//         child.stderr.on('data',
//             function (data) {
//                 log.error('encode process stderr: ' + data);
//             }
//         );
//
//         child.on('exit', function (exitCode) {
//             log.info("Child exited with code: " + exitCode);
//
//             if (exitCode === 0) {
//
//                 doneCount++;
//
//                 if (doneCount == EVKNUM ) {
//
//                     log.info("End: " + new Date());
//
//
//                     var yuvFile = seq.title + '_yuv_v' + versionNum + '_' + channelAbr;
//
//                     cp(serverItunerPath, serverOutputPath);
//                     mv(serverOutputPath, yuvPath + yuvFile);
//
//                     if (title == ""){
//                         title = seq.title;
//                         doneChannelCount++;
//                     } else {
//
//                         if (title == seq.title){
//                             doneChannelCount++;
//                         } else {
//                             title = seq.title;
//                             doneChannelCount = 1;
//                         }
//                     }
//
//                     // var updateDB = false;
//
//                     if (doneChannelCount != 0 && doneChannelCount%2 == 0){
//
//                         var query = {
//                             condition: {title: seq.title},
//                             update: {$push: {
//                                 "cameras.0.yuv": {
//                                     "version": versionNum,
//                                     "desc": ituner
//                                 }
//                             }},
//                             options: {multi: false}
//                         };
//
//
//                         log.info('update DB: ' + query.condition.title);
//
//                         var options = {
//                             url: updateURL,
//                             json: true,
//                             body: query,
//                             timeout: 1000000
//                         };
//
//                         request.post(options, function(error, response, body) {
//
//                             if ( error ) {
//                                 log.error('Update DB failed', error);
//
//                             } else {
//                                 if ( response.statusCode == 200 ) {
//                                     log.info('Update success', body);
//                                 }
//                                 else {
//                                     log.error('Update failed', response.statusCode);
//                                 }
//                             }
//                         });
//
//                         // updateDB = true;
//                     }
//
//                     var dewarp_job = queue.create('dewarp', {
//                         sequenceObj: seq,
//                         channel: channel,
//                         versionNum: versionNum
//                     });
//
//                     dewarp_job.save();
//
//                     // var tar_yuv_job = queue.create('tar_yuv', {
//                     //     yuvPath: yuvPath,
//                     //     yuvFile: yuvFile,
//                     //     updateDB: updateDB,
//                     //     query: query
//                     // });
//                     //
//                     // tar_yuv_job.save();
//
//
//                     done(null, 'encode_done');
//                 }
//             } else {
//                 log.error("encode failed with code: " + exitCode);
//
//
//             }
//
//         });
//
//         startFrame = startFrame + divideFrame;
//         ip++;
//     }
//
// });


queue.process('dewarp', function (job, done){

    if(queueSwitch.dewarp){

        log.info("Processing dewarp: ", job.data.sequenceObj.title);
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

                log.info('dewarp completed: ' + seq.title);

                rm('-r', inputDir);
                mv(outputDir, inputDir);
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

                log.info('cat completed: ' + seq.title);

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

    log.info("Processing encode_HEVC: ", job.data.sequenceObj.title);
    log.info("Start: " + new Date());

    var seq = job.data.sequenceObj;
    var channel = job.data.channel;
    var versionNum = job.data.versionNum;
    var ituner = job.data.ituner;

    if(queueSwitch.encode_HEVC){



        var inputDir = '';

        if (channel == 'left'){
            inputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/cat.yuv';
            outputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/' + seq.title + '_h265_v' + versionNum + '_L.mp4';

        } else {
            inputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/cat.yuv';
            outputDir = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/' + seq.title + '_h265_v' + versionNum + '_R.mp4';
        }

        var cmd = 'ffmpeg -f rawvideo -pix_fmt nv12 -s:v 3840x2160 -r 30 -i ' + inputDir + ' -c:v libx265 ' + outputDir;

        exec(cmd, {async:true}, function (code, stdout, stderr) {

            if (code == 0) {

                log.info('encode_HEVC completed: ' + seq.title);

                rm(inputDir);


                //** update DB here **//
                if (channel == 'right'){

                    var query = {
                        condition: {title: seq.title},
                        update: {$push: {
                            "cameras.0.yuv": {
                                "version": versionNum,
                                "desc": ituner
                            }
                        }},
                        options: {multi: false}
                    };


                    log.info('update DB: ' + query.condition.title);

                    var options = {
                        url: updateURL,
                        json: true,
                        body: query,
                        timeout: 1000000
                    };

                    request.post(options, function(error, response, body) {

                        if ( error ) {
                            log.error('Update DB failed', error);

                        } else {
                            if ( response.statusCode == 200 ) {
                                log.info('Update success', body);
                            }
                            else {
                                log.error('Update failed', response.statusCode);
                            }
                        }
                    });
                }



                done(null, 'encode_HEVC_done');

            } else {
                log.error("encode_HEVC command failed. stderr: " + stderr);
            }
        });

    } else {
       
        done(null, 'encode_HEVC_done');
    }

});


// queue.process('tar_yuv', function (job, done){
//
//     var yuvPath = job.data.yuvPath;
//     var yuvFile = job.data.yuvFile;
//     var updateDB = job.data.updateDB;
//     var query = job.data.query;
//
//     log.info('tar: ' + yuvFile);
//
//     cd(yuvPath);
//     exec('tar -cf ' + yuvFile + '.tar ' + yuvFile, {async:true}, function (code, stdout, stderr) {
//
//         // log.debug("code: " + code);
//         // log.debug("stdout: " + stdout);
//         // log.debug("stderr: " + stderr);
//
//         if (code == 0) {
//
//             log.info('tar completed: ' + yuvFile);
//
//             rm('-r', yuvPath + yuvFile);
//
//             // Update DB
//             if (updateDB){
//
//                 log.info('update DB: ' + query.condition.title);
//
//                 var options = {
//                     url: updateURL,
//                     json: true,
//                     body: query,
//                     timeout: 1000000
//                 };
//
//                 request.post(options, function(error, response, body) {
//
//                     if ( error ) {
//                         log.error('Update DB failed', error);
//
//                     } else {
//                         if ( response.statusCode == 200 ) {
//                             log.info('Update success', body);
//                         }
//                         else {
//                             log.error('Update failed', response.statusCode);
//                         }
//                     }
//                 });
//             }
//
//             done(null, 'tar_yuv_done');
//
//         } else {
//             log.error("tar command failed. stderr: " + stderr);
//
//         }
//     });
//
//     cd(currentPath);
// });


queue.process('genAnnotation', function (job, done){


    var seq = job.data.sequenceObj;
    var batchSequenceCount = job.data.batchSequenceCount;

    log.info("Processing genAnnotation: " + seq.title);

    if (queueSwitch.genAnnotation){
        // Create annotation request package
        var annotationPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/annotation/temp/';

        // var h264 = seq.title + '_h264_R.mp4';
        var h265 = seq.title + '_h265_v1_R.mp4';


        mkdir(annotationPath);

        // cp('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/cali_data/RECT_Right.blt', annotationPath);

        cp('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/' + h265, annotationPath);

        seq.cameras[0].annotation.forEach(function(request){

            switch (request.category){
                case "moving_object":
                    genTask("Vehicle", seq, annotationPath, h265, request);
                    genTask("Pedestrian", seq, annotationPath, h265, request);
                    break;
                case "free_space":
                    genTask("Road", seq, annotationPath, h265, request);
                    genTask("Lane", seq, annotationPath, h265, request);
                    break;
                case "free_space_with_curb":
                    genTask("Road-with-curb", seq, annotationPath, h265, request);
                    genTask("Lane", seq, annotationPath, h265, request);
                    break;
            }

        });

        cd(annotationPath);
        exec('tar -czf ' + '../' + seq.title + '.tar.gz ' + '*');

        cp('../' + seq.title + '.tar.gz', batchPath);

        cd(currentPath);
        rm('-r', annotationPath);

        // // Insert sequence to DB
        //
        // var options = {
        //     url: insertURL,
        //     json: true,
        //     body: seq,
        //     timeout: 1000000
        // };
        //
        // request.post(options, function(error, response, body) {
        //     // log.debug('update path response', response, 'body', body, 'error', error);
        //     // log.debug('body: ', body, 'error: ', error);
        //
        //     if ( error ) {
        //         log.error('Insert DB failed', error);
        //
        //
        //     }
        //     else {
        //         if ( response.statusCode == 200 ) {
        //             log.debug('Insert success', body);
        //             done(null, 'genAnnotation_done');
        //         }
        //         else {
        //             log.error('Insert failed', response.statusCode);
        //         }
        //     }
        // });

        log.debug('batchSequenceCount: ', batchSequenceCount);



        if (batchSequenceCount == 1){
            log.debug('tar whole batch');

            var batchCreateTime = new Date().toISOString();
            var batchName = batchCreateTime.substring(0, 19);
            batchName = batchName.replace('T','-');
            batchName = batchName.replace(/:/g, '');

            touch(batchPath + 'priority.txt');
            fs.writeFileSync(batchPath + 'priority.txt', priority_text["Vehicle"] + priority_text["Pedestrian"] + priority_text["Road"] + priority_text["Road-with-curb"] + priority_text["Lane"], 'utf-8');

            priority_text = {
                "Vehicle": "",
                "Pedestrian": "",
                "Road": "",
                "Road-with-curb": "",
                "Lane": ""
            };

            mkdir(batchPath + '../' + batchName);
            mv(batchPath + '*', batchPath + '../' + batchName);


            cd(batchPath + '../' + batchName);
            exec('tar -czf ' + '../' + batchName + '.tar.gz ' + '*');
            cd(currentPath);
            rm('-r', batchPath + '../' + batchName);


            var query = {
                batchName: batchName,
                batchCreateTime: batchCreateTime
            };

            var options = {
                url: batchURL,
                json: true,
                body: query,
                timeout: 1000000
            };

            request.post(options, function(error, response, body) {

                if ( error ) {
                    log.error('Insert batch failed', error);
                } else {
                    if ( response.statusCode == 200 ) {
                        log.debug('Insert batch success', body);
                    }
                    else {
                        log.error('Insert batch failed', response.statusCode);
                    }
                }
            });

        }


        done(null, 'genAnnotation_done');

    } else {
        done(null, 'genAnnotation_done');
    }





});


queue.on('job enqueue', function(id, type){

    log.info('Job %s got queued of type %s', id, type );

}).on('job complete', function(id, result){

    if (result === 'import_new_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed import_new job #%d', job.id);
            });

        });
    }


    if (result === 'decompress_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;


            var encode_job = queue.create('encode', {
                sequenceObj: job.data.sequenceObj,
                channel: 'left',
                isInitEncode: true
            });

            encode_job.save(); //Todo: Uncomment this line to start encode

            encode_job = queue.create('encode', {
                sequenceObj: job.data.sequenceObj,
                channel: 'right',
                isInitEncode: true
            });

            encode_job.save(); //Todo: Uncomment this line to start encode


            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed decompress job #%d', job.id);
            });

        });
    }


    if (result === 'encode_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed encode job #%d', job.id);
            });
        });
    }

    if (result === 'dewarp_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;


            var cat_job = queue.create('cat', {
                sequenceObj: job.data.sequenceObj,
                channel: job.data.channel,
                ituner: job.data.ituner,
                versionNum: job.data.versionNum
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
                sequenceObj: job.data.sequenceObj,
                channel: job.data.channel,
                ituner: job.data.ituner,
                versionNum: job.data.versionNum
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

            if (job.data.channel == 'right'){
                var genAnnotation = queue.create('genAnnotation', {
                    sequenceObj: job.data.sequenceObj,
                    batchSequenceCount: 1
                });

                genAnnotation.save();
            }


            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed encode_HEVC job #%d', job.id);
            });
        });

    }


    if (result === 'genAnnotation_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;

            // var disparity_job = queue.create('disparity', {
            //     sequenceObj: job.data.sequenceObj
            // });
            //
            // disparity_job.save();

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed genAnnotation job #%d', job.id);
            });

        });
    }

    // if (result === 'tar_yuv_done'){
    //
    //     kue.Job.get(id, function(err, job){
    //         if (err) return;
    //
    //
    //         job.remove(function(err){
    //             if (err) throw err;
    //             log.info('removed completed tar_yuv job #%d', job.id);
    //         });
    //     });
    //
    // }


});









// node telnet

// var connection = new telnet();
//
// var params = {
//     host: '192.168.240.' + ip,
//     timeout: 10000
// };
//
// connection.on('ready', function (prompt) {
//     connection.exec(cmd, function (err, response) {
//         if (err) {
//             log.debug('Error: ', response);
//         } else {
//             // log.debug(seq.title, ': ', response);
//             connection.end();
//         }
//     });
// });
//
// connection.on('timeout', function () {
//     log.debug(seq.title, ': socket timeout!');
//     connection.end();
// });
//
// connection.on('close', function () {
//     log.debug(seq.title, ': connection closed');
//
//     doneCount++;
//     // log.debug("Done encode" + ' i:' + i + ', doneCount:' + doneCount);
//
//     if (doneCount == EVKNUM ) {
//         // mv(serverOutputPath, yuvPath + 'v' + maxVersion);
//         done(null, 'encode_done');
//     }
//
// });
//
// connection.connect(params);
