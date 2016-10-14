/**
 * Created by rayfang on 6/27/16.
 */
const kue = require('kue');
const queue = kue.createQueue();
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
var insertURL = 'http://localhost:3001/api/sequence/insert';
var updateURL = 'http://localhost:3001/api/sequence/update';
var batchURL = 'http://localhost:3001/api/annotation/insertBatch';




app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


var server = app.listen(process.env.PORT || 3004, function () {
    log.info("File server listening on port %s...", server.address().port);
});



const EVKNUM = 10;
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


var genTask = function (task, seq, annotationPath, h264, request) {

    var taskPath = annotationPath + seq.title + '_' + task + '/';

    mkdir(taskPath);

    cp(templatePath + 'Classes.ini', taskPath);

    var Annotate_ini = fs.readFileSync(templatePath + 'Annotate_' + task + '.ini', 'utf-8');
    Annotate_ini = Annotate_ini.replace('@json', seq.title + '_' + request.category); // Todo: edit json file name


    var cali_right_ini = fs.readFileSync('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/cali_data/Right.ini', 'utf-8');
    var cali_left_ini = fs.readFileSync('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/cali_data/Left.ini', 'utf-8');


    var sequence_ini = sequence_ini_template;
    sequence_ini = sequence_ini.replace('@rightFile', h264);
    sequence_ini = sequence_ini.replace('@rightCali', convert_ini(cali_right_ini));
    sequence_ini = sequence_ini.replace('@leftCali', convert_ini(cali_left_ini));


    var sequence_mef = sequence_mef_template.replace('@file', h264);
    sequence_mef = sequence_mef.replace('@rate', 30/request.fps);


    var session = session_template.replace(/@path/g, seq.title + '_' + task);


    priority_text[task] = priority_text[task] + seq.title + '_' + task + ' ' + request.priority + '\n';


    fs.writeFileSync(taskPath + 'Annotate.ini', Annotate_ini, 'utf-8');
    fs.writeFileSync(taskPath + seq.title + '_' + task + '.ini', sequence_ini, 'utf-8');
    fs.writeFileSync(taskPath + seq.title + '_' + task  + '.mef', sequence_mef, 'utf-8');
    fs.writeFileSync(taskPath + 'sessions.ini', session, 'utf-8');

};


queue.process('processSequence', function (job, done){


    var seq = job.data.sequenceObj;
    var batchSequenceCount = job.data.batchSequenceCount;

    log.info("Processing Import: " + seq.title);


    // Create annotation request package
    var annotationPath = '/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/annotation/temp/';
    // var annotationPath = '/supercam/vol1/annotation/testTemp/';

    var h264 = seq.title + '_h264_R.mp4';

    mkdir(annotationPath);

    cp('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/cali_data/RECT_Right.blt', annotationPath);  // Calibration file will come with each sequence Todo: change the blt file name in sequence.ini
    cp('/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/' + h264, annotationPath);

    seq.cameras[0].annotation.forEach(function(request){

        switch (request.category){
            case "moving_object":
                genTask("Vehicle", seq, annotationPath, h264, request);
                genTask("Pedestrian", seq, annotationPath, h264, request);
                break;
            case "free_space":
                genTask("Road", seq, annotationPath, h264, request);
                genTask("Lane", seq, annotationPath, h264, request);
                break;
            case "free_space_with_curb":
                genTask("Road-with-curb", seq, annotationPath, h264, request);
                genTask("Lane", seq, annotationPath, h264, request);
                break;
        }

    });

    cd(annotationPath);
    exec('tar -czf ' + '../' + seq.title + '.tar.gz ' + '*');

    cp('../' + seq.title + '.tar.gz', batchPath);

    cd(currentPath);
    rm('-r', annotationPath);


    // Insert sequence to DB

    // Todo: testing
    var options = {
        url: insertURL,
        json: true,
        body: seq,
        timeout: 10000
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
                done(null, 'import_done');
            }
            else {
                log.error('Insert failed', response.statusCode);
            }
        }
    });



    log.debug('batchSequenceCount: ', batchSequenceCount);

    // done(null, 'import_done');  // Todo: comment out this line


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
            timeout: 10000
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






});



queue.process('encode', function (job, done){

    log.info('Processing encode ' + job.data.sequenceObj.title + ' ' + job.data.channel);
    log.info("Start: " + new Date());


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


    var frameNum = seq.frame_number;  //Todo: Testing
    // var frameNum = 200;
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

        if (seq.keywords.length == 0) {
            // Default ituner if no keyword match
            ituner = '20161013_daytime.ini';
        } else {
            for (var i = 0; i < seq.keywords.length; i++) {

                if (seq.keywords[i] == 'Back_lit') {
                    ituner = '20161013_backlit.ini';
                    break;
                }

                if (seq.keywords[i] == 'Night_with_street_light' || seq.keywords[i] == 'Night_without_street_light') {
                    ituner = '20161013_nighttime_Br_LV2.ini';
                    break;
                }

                // Default ituner if no keyword match
                ituner = '20161013_daytime.ini';
            }
        }


    } else {

        var versionNum = 0;

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
        var cmd = './raw_encode_check.sh /mnt/ssd_1;sleep 1; test_ituner -e ' + itunerPath + ';sleep 3;./raw_encode_tao.sh ' + inputPath + ' ' + outputPath + ' ' + startFrame + ' ' + divideFrame + ' 1';

        // var cmd = './raw_encode_check.sh /mnt/ssd_1;sleep 1; test_ituner -e ' + itunerPath + ';sleep 3;./raw_encode.sh ' + inputPath + ' ' + outputPath + ' ' + startFrame + ' ' + divideFrame + ' 1';


        // log.debug('cmd: ', cmd);

        var child = spawn('ruby', ['telnet.rb', cmd, '192.168.240.' + ip]);

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
                    mv(serverOutputPath, yuvPath + yuvFile); // Todo: Testing
                    cd(yuvPath);

                    exec('tar -cf ' + yuvFile + '.tar ' + yuvFile, {async:true}, function (code, stdout, stderr) {

                        // log.debug("code: " + code);
                        // log.debug("stdout: " + stdout);
                        // log.debug("stderr: " + stderr);

                        if (code == 0) {

                            rm('-r', yuvPath + yuvFile); //Todo: to be tested

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
                            if (doneChannelCount != 0 && doneChannelCount%2 == 0){

                                log.info('update DB');
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
                                    timeout: 10000
                                };

                                // Todo: Testing
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
                        } else {
                            log.error("tar command failed. stderr: " + stderr);

                        }
                    });  // Todo: Testing   change to async

                    cd(currentPath);


                    done(null, 'encode_done');
                }
            } else {
                log.error("encode failed with code: " + exitCode);


            }

        });

        startFrame = startFrame + divideFrame;
        ip++;
    }

});



queue.on('job enqueue', function(id, type){

    log.info('Job %s got queued of type %s', id, type );

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
                log.info('removed completed import job #%d', job.id);
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

    // if (result === 'update_db_done'){
    //
    //     kue.Job.get(id, function(err, job){
    //         if (err) return;
    //
    //
    //         job.remove(function(err){
    //             if (err) throw err;
    //             log.info('removed completed db job #%d', job.id);
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
