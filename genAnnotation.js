/**
 * Created by cjfang on 1/26/17.
 */

var genAnnotation = true;


const kue = require('kue');
const queue = kue.createQueue({
    redis: {
        port: 6379,
        host: '10.1.3.32'
    }
});
const express = require("express");
const bodyParser = require("body-parser");
const log4js = require('log4js');
log4js.configure(require('./log_config.json').genAnnotation);
const log = log4js.getLogger('genAnnotation');
const app = express();
const fs = require('fs');
const request = require('request');
const config = require('./config');
const readline = require('readline');
require('shelljs/global');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var insertURL = config.insertURL;
var batchURL = config.batchURL;

const SITE = 'us';

var templatePath = "/supercam/vol1/annotation/annotation_template/";
var batchPath = "/supercam/vol1/annotation/tasks_batch/temp/";
var sequence_ini_template = fs.readFileSync(templatePath + 'sequence.ini', 'utf-8');
var sequence_mef_template = fs.readFileSync(templatePath + 'sequence.mef', 'utf-8');
var session_template = fs.readFileSync(templatePath + 'sessions.ini', 'utf-8');
var currentPath = pwd();
var priority_text = {
    "Vehicle": "",
    "Pedestrian": "",
    "Road": "",
    "Road-with-curb": "",
    "Lane": ""
};


var server = app.listen(process.env.PORT || 3003, function () {
    log.info("File server listening on port %s...", server.address().port);
});


var getRootPathBySite = function (siteArray) {

    for (var i=0; i < siteArray.length; i++) {
        if (siteArray[i].site === SITE) {
            return siteArray[i].root_path;
        }
    }
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


queue.process('genAnnotation', function (job, done){


    var seq = job.data.sequenceObj;
    var batchAnnCount = job.data.batchAnnCount;
    var annRemains = job.data.annRemains;
    var curSeqCount = job.data.curSeqCount;
    //log.debug("annRemains: ",annRemains);
    //log.debug("batchAnnCount: ",batchAnnCount);
    //log.debug("curSeqCount: ",curSeqCount);

    log.info("Processing genAnnotation: " + seq.title);

    if (genAnnotation){
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

        // Insert sequence to DB

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
                    done(null, 'genAnnotation_done');
                }
                else {
                    log.error('Insert failed', response.statusCode);
                }
            }
        });

        log.debug('curSeqCount: ', curSeqCount);
        log.debug("annRemains: ",annRemains);
        log.debug("batchAnnCount: ",batchAnnCount);
        if ((curSeqCount%30) == 0 || (batchAnnCount <= 0 && (curSeqCount%30) == annRemains)){
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
    } else {
        done(null, 'genAnnotation_done');
    }

});


