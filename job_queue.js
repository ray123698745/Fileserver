/**
 * Created by rayfang on 6/27/16.
 */
var kue = require('kue');
var queue = kue.createQueue();
var spawn = require('child_process').spawn;
var log = require('log4js').getLogger('job_queue');
var express = require("express");
var bodyParser = require("body-parser");
var app = express();
var fs = require('fs');
var request = require('request');
require('shelljs/global');
var telnet = require('telnet-client');
// var connection = new telnet();
// var insertURL = 'http://localhost:3001/api/sequence/insert';
var insertURL = 'http://localhost:3000/api/sequence/insert';

var updateURL = 'http://localhost:3001/api/sequence/update';
// var updateURL = 'http://localhost:3000/api/sequence/update';


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


var server = app.listen(process.env.PORT || 3004, function () {
    log.debug("File server listening on port %s...", server.address().port);
});



const EVKNUM = 5;
const SITE = 'us';

var templatePath = "/supercam/vol1/annotation_template/";
var sequence_ini_template = fs.readFileSync(templatePath + 'sequence.ini', 'utf-8');
var sequence_mef_template = fs.readFileSync(templatePath + 'sequence.mef', 'utf-8');
var session_template = fs.readFileSync(templatePath + 'sessions.ini', 'utf-8');
var currentPath = pwd();

var title = "";
var doneChannelCount = 0;


var getRootPathBySite = function (siteArray) {

    for (var i=0; i < siteArray.length; i++) {
        if (siteArray[i].site === SITE) {
            return siteArray[i].root_path;
        }
    }
};


queue.process('processSequence', function (job, done){



    var seq = job.data.sequenceObj;
    log.debug("Processing Import: " + seq.title);


    // Create annotation request package

    // var annotationPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/annotation/temp/';
    // var h264 = seq.title + '_h264_R.mp4';
    //
    // mkdir(annotationPath);
    //
    // cp(templatePath + 'RECT_Right.blt', annotationPath);  // Calibration file will come with each sequence Todo: change the blt file name in sequence.ini
    // cp('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/' + h264, annotationPath);
    //
    // seq.cameras[0].annotation.forEach(function(request){
    //
    //     var taskPath = annotationPath + seq.title + '_' + request.category + '/';
    //
    //     mkdir(taskPath);
    //
    //     cp(templatePath + 'Classes.ini', taskPath);
    //     cp(templatePath + 'Annotate_' + request.category + '.ini', taskPath + 'Annotate.ini');
    //
    //
    //     var sequence_ini = sequence_ini_template.replace('@file', h264);
    //     var sequence_mef = sequence_mef_template.replace('@file', h264);
    //     // sequence_mef = sequence_mef.replace('@num', seq.frame_number);
    //     sequence_mef = sequence_mef.replace('@rate', 30/request.fps);
    //
    //     var session = session_template.replace(/@path/g, seq.title + '_' + request.category);
    //
    //
    //     fs.writeFileSync(taskPath + seq.title + '_' + request.category + '.ini', sequence_ini, 'utf-8');
    //     fs.writeFileSync(taskPath + seq.title + '_' + request.category + '.mef', sequence_mef, 'utf-8');
    //     fs.writeFileSync(taskPath + 'sessions.ini', session, 'utf-8');
    //
    //
    // });
    //
    // cd(annotationPath);
    // exec('tar -czf ' + '../' + seq.title + '.tar.gz ' + '*');
    // cd(currentPath);
    // rm('-r', annotationPath);
    //
    //
    // // Insert sequence to DB
    //
    // var options = {
    //     url: insertURL,
    //     json: true,
    //     body: seq,
    //     timeout: 2000
    // };

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
    //             done(null, 'import_done');
    //         }
    //         else {
    //             log.error('Insert failed', response.statusCode);
    //         }
    //     }
    // });


    // Todo: Delete unselected sequence and unfilteredSequence documents


    done(null, 'import_done');  // Todo: comment out this line

});



queue.process('encode', function (job, done){

    log.debug('Processing encode ' + job.data.sequenceObj.title + ' ' + job.data.channel);
    log.debug("Start: " + new Date());


    var seq = job.data.sequenceObj;
    var isInitEncode = job.data.isInitEncode;
    var channel = job.data.channel;


    if (channel == 'left'){
        // var inputPath = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/raw';
        // var outputPath = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/temp/';
        var inputPath = '/mnt/ssd_1/' + seq.title + '/Front_Stereo/L/raw';
        var outputPath = '/mnt/ssd_1/' + seq.title + '/Front_Stereo/L/yuv/temp/';
        var serverOutputPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/temp/';
        var yuvPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/yuv/';
        var channelAbr = 'L';

    } else {
        // var inputPath = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/raw';
        // var outputPath = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/temp/';
        var inputPath = '/mnt/ssd_1/' + seq.title + '/Front_Stereo/R/raw';
        var outputPath = '/mnt/ssd_1/' + seq.title + '/Front_Stereo/R/yuv/temp/';
        var serverOutputPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/temp/';
        var yuvPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/yuv/';
        var channelAbr = 'R';
    }


    var frameNum = seq.frame_number;
    // var frameNum = 500;
    var divideFrame = parseInt(frameNum / EVKNUM);
    var startFrame = 0;
    var doneCount = 0;
    var ip = 10;
    var ituner = "";
    var itunerPath = "/home/amba/ini/";
    var serverItunerPath = "/supercam/vol1/ini/";


    mkdir(serverOutputPath);

    // Set ituner & version number
    if (isInitEncode) {

        var versionNum = 1;

        for (var i = 0; i < seq.keywords.length; i++) {

            if (seq.keywords[i] == 'Back_lit') {
                ituner = 'liso_v_42v2_3840_new_ce_tao_backlight_compressed.ini';
                break;
            }

            if (seq.keywords[i] == 'Bright') {
                ituner = 'liso_v_42v2_3840_new_ce_tao_day_compressed.ini';
                break;
            }

            if (seq.keywords[i] == 'Night_with_street_light' || seq.keywords[i] == 'Night_without_street_light') {
                ituner = 'liso_v_42v2_3840_new_ce_tao_night_compressed.ini';
                break;
            }
        }
    } else {

        var versionNum = 0;

        seq.cameras[0].yuv.forEach(function (yuvVersion) {
            if (yuvVersion.version > versionNum) versionNum = yuvVersion.version;
            // log.debug('in forEach versionNum', versionNum);

        });

        versionNum++;
        // log.debug('out forEach versionNum', versionNum);

        ituner = job.data.ituner;
    }

    itunerPath += ituner;
    serverItunerPath += ituner;

    // Raw encode loop
    for (var i = 0; i < EVKNUM ; i++) {

        if (i == EVKNUM - 1)
            divideFrame = divideFrame + (frameNum % EVKNUM);


        // var cmd = './raw_encode.sh ' + inputPath + ' ' + outputPath + ' ' + startFrame + ' ' + divideFrame;
        // var cmd = './raw_encode_with_ituner.sh ' + inputPath + ' ' + outputPath + ' ' + startFrame + ' ' + divideFrame + ' ' + itunerPath;

        var cmd = 'test_ituner -e ' + itunerPath + ';sleep 5;./raw_encode.sh ' + inputPath + ' ' + outputPath + ' ' + startFrame + ' ' + divideFrame + ' 1';

        // log.debug('cmd: ', cmd);
        // log.debug('ip: ', ip, 'startFrame: ', startFrame, ', divideFrame: ', divideFrame);

        var child = spawn('ruby',
            ['telnet.rb', cmd, '192.168.240.' + ip]);

        // child.stdout.on('data',
        //     function (data) {
        //         log.debug('stdout: ' + data);
        //     }
        // );

        child.stderr.on('data',
            function (data) {
                log.debug('stderr: ' + data);
            }
        );

        child.on('exit', function (exitCode) {
            log.debug("Child exited with code: " + exitCode);

            if (exitCode === 0) {

                doneCount++;

                if (doneCount == EVKNUM ) {

                    log.debug("End: " + new Date());


                    var yuvFile = seq.title + '_yuv_v' + versionNum + '_' + channelAbr;

                    cp(serverItunerPath, serverOutputPath);
                    mv(serverOutputPath, yuvPath + yuvFile); // Todo: Testing
                    cd(yuvPath);
                    exec('tar -cf ' + yuvFile + '.tar ' + yuvFile);  // Todo: Testing   change to ansync
                    cd(currentPath);

                    // rm('-r', yuvPath + yuvFile);  // Todo: if no further process, then delete the folder

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

                    // log.debug('doneChannelCount: ', doneChannelCount);

                    // Update DB
                    if (doneChannelCount%2 == 0){

                        log.debug('update DB');
                        var query = {
                            condition: {_id: seq._id},
                            update: {$push: {
                                "cameras.0.yuv": {
                                    "version": versionNum,
                                    "desc": ituner
                                }
                            }},
                            options: {multi: false}
                        };

                        var options = {
                            url: updateURL,
                            json: true,
                            body: query,
                            timeout: 2000
                        };

                        // Todo: Testing
                        request.post(options, function(error, response, body) {

                            if ( error ) {
                                log.error('Update DB failed', error);

                            } else {
                                if ( response.statusCode == 200 ) {
                                    log.debug('Update success', body);
                                }
                                else {
                                    log.error('Update failed', response.statusCode);
                                }
                            }
                        });
                    }


                    done(null, 'encode_done');
                }
            }

        });

        startFrame = startFrame + divideFrame;
        ip++;
    }

});



queue.on('job enqueue', function(id, type){

    log.debug('Job %s got queued of type %s', id, type );

}).on('job complete', function(id, result){

    if (result === 'import_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;


            var decompress_job = queue.create('decompress', {
                sequenceObj: job.data.sequenceObj
            });

            decompress_job.save();  //Todo: Uncomment this line to start decompress

            job.remove(function(err){
                if (err) throw err;
                console.log('removed completed import job #%d', job.id);
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
                console.log('removed completed decompress job #%d', job.id);
            });

        });
    }


    if (result === 'encode_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;



            job.remove(function(err){
                if (err) throw err;
                console.log('removed completed encode job #%d', job.id);
            });
        });
    }

    // if (result === 'update_db_done'){
    //
    //     kue.Job.get(id, function(err, job){
    //         if (err) return;
    //
    //
    //         job.remove(function(err){
    //             if (err) throw err;
    //             console.log('removed completed db job #%d', job.id);
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
