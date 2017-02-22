/**
 * Created by cjfang on 1/26/17.
 */
/**
 * Created by cjfang on 7/25/16.
 */

var importSwitch = {
    integrityCheck: true,
    parseSensor: true,
    country: 'Taiwan',
    parseSensorCallback: true,
    genThumb: true,
    setupFolder: true,
    parseMeta: true,
    insertDB: true,
    decompress: true,
    dewarp: true,
    cat: true,
    encode_HEVC: true,
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
const express = require("express");
const bodyParser = require("body-parser");
const log4js = require('log4js');
log4js.configure('log_config.json', { reloadSecs: 300 });
const log = log4js.getLogger('import');
const app = express();
const fs = require('fs');
const request = require('request');
const config = require('./config');
const readline = require('readline');
const GoogleMapsAPI = require('googlemaps');
require('shelljs/global');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var newArrived = config.newArrived;
var seqRoot = config.seq;
var insertURL = config.insertURL;
var updateURL = config.updateURL;
var batchURL = config.batchURL;
var csvPath = config.csvPath;
var keyArr = config.keyArr;
var countryCode = config.countryCode;

const THREADS = 1;
const SITE = 'us';

var templatePath = "/supercam/vol1/annotation/annotation_template/";
var batchPath = "/supercam/vol1/annotation/tasks_batch/temp/";
var sequence_ini_template = fs.readFileSync(templatePath + 'sequence.ini', 'utf-8');
var sequence_mef_template = fs.readFileSync(templatePath + 'sequence.mef', 'utf-8');
var session_template = fs.readFileSync(templatePath + 'sessions.ini', 'utf-8');
var currentPath = pwd();
// var curSeqCount = 0;
// var batchAnnCount = 0;
// var annRemains = 0;
var priority_text = {
    "Vehicle": "",
    "Pedestrian": "",
    "Road": "",
    "Road-with-curb": "",
    "Lane": ""
};

var publicConfig = {
    key: 'AIzaSyBKazcMqdk5t0mJcyv7lroFEKtLthpFaLg',
    stagger_time:       1000, // for elevationPath
    encode_polylines:   false,
    secure:             true // use https
    // proxy:              'http://127.0.0.1:9999' // optional, set a proxy for HTTP requests
};
var gmAPI = new GoogleMapsAPI(publicConfig);

var server = app.listen(process.env.PORT || 3003, function () {
    log.info("File server listening on port %s...", server.address().port);
});

var allKeyword = [];

// genKeywords();


var getRootPathBySite = function (siteArray) {

    for (var i=0; i < siteArray.length; i++) {
        if (siteArray[i].site === SITE) {
            return siteArray[i].root_path;
        }
    }
};


function genKeywords() {

    var rl = readline.createInterface({
        terminal: false,
        input: fs.createReadStream(csvPath)
    });

    rl.on('line', function(line){

        if(line.charAt(0) == 'S'){

            var title = line.substring(0, 28);
            var parsedTitle = title.substring(11);
            parsedTitle = parsedTitle.replace(/:/g, "");
            parsedTitle = parsedTitle + "-" + countryCode;

            var content = line.substring(29);
            content = content.replace(/,/g, "");

            var tempArr = [];

            for(var i = 0; i < keyArr.length; i++){
                if (content[i] == 1)
                    tempArr.push(keyArr[i]);
            }

            allKeyword.push({
                title: parsedTitle,
                keywords: tempArr
            });

        }


    }).on('close', function () {

        log.debug('closed');

        integrityCheck();
    });

}

function integrityCheck() {

    fs.readdir(newArrived + "L/", function(err, seqs) {
        if (err){
            log.error(err);
        } else {
            log.debug(seqs);

            var batchAnnCount = parseInt(seqs.length / 30);
            var annRemains = seqs.length % 30;

            seqs.forEach(function(seq){

                if (seq.charAt(0) == 'S'){

                    // if (importSwitch.integrityCheck){
                    if (false){

                        // Check file integrity
                        var exitCodeL = exec('./test_folder_gen.sh ' + newArrived + "L/" + seq).code;
                        var exitCodeR = exec('./test_folder_gen.sh ' + newArrived + "R/" + seq).code;

                        if (exitCodeL == 0 && exitCodeR == 0
                            && ls(newArrived + "L/" + seq + "/*.raw").length == ls(newArrived + "R/" + seq + "/*.raw").length
                            && ls(newArrived + "L/" + seq + "/OtherSensors*/*.ini").length > 0
                            && ls(newArrived + "L/" + seq + "/OtherSensors*/*.mef").length > 0
                            && ls(newArrived + "L/" + seq + "/cali_data/Left.ini").length > 0
                            && ls(newArrived + "R/" + seq + "/cali_data/Right.ini").length > 0)
                        {

                            log.info('Import: ' + seq);

                            var import_new_job = queue.create('import_new', {
                                seq: seq,
                                allKeyword :allKeyword,
                                batchAnnCount: batchAnnCount,
                                annRemains: annRemains
                            });

                            import_new_job.save();

                        } else {
                            log.error('Import: ' + seq + ' failed!');
                        }
                    } else {
                        log.info('Import: ' + seq);

                        var import_new_job = queue.create('import_new', {
                            seq: seq,
                            allKeyword :allKeyword,
                            batchAnnCount: batchAnnCount,
                            annRemains: annRemains

                        });

                        import_new_job.save();
                    }


                }

            });
        }

    });
}


queue.process('import_new', function (job, done){

    parseSensor(job.data.seq, done, job.data.allKeyword, job.data.batchAnnCount, job.data.annRemains);

});


function parseSensor(seq, done, allKeyword, batchAnnCount, annRemains) {

    if (importSwitch.parseSensor){
        var fileName =  ls(newArrived + 'R/' + seq + '/OtherSensors*/*.mef');

        if (fileName.length == 0){
            log.error(seq +  " import failed: No OtherSensors");
        }
        var isClosed = false;

        var rl = readline.createInterface({
            terminal: false,
            input: fs.createReadStream(fileName[0])
        });

        var latitudePos = 0;
        var longitudePos = 0;
        var altitudePos = 0;
        var latitude = 0;
        var longitude = 0;
        var country = '';
        var state = '';
        var city = '';

        rl.on('line', function(line){

            latitudePos = line.search('latitude');
            longitudePos = line.search(',longitude');
            altitudePos = line.search(',altitude');

            if (latitudePos != -1 && !isClosed){

                latitudePos = latitudePos + 9;

                latitude = line.substring(latitudePos, latitudePos + (longitudePos - latitudePos));

                longitudePos = longitudePos + 11;

                longitude = line.substring(longitudePos, longitudePos +  (altitudePos - longitudePos));

                isClosed = true;
                rl.close();
            }
        }).on('close', function () {

            // log.debug("latitude: " + latitude + ", longitude: " + longitude);

            //todo: testing-- change -longitude
            var reverseGeocodeParams = {
                "latlng":        latitude + "," + longitude,
                "result_type":   "country|administrative_area_level_1|locality",
                "language":      "en",
                "location_type": "APPROXIMATE"
            };

            gmAPI.reverseGeocode(reverseGeocodeParams, function(err, result){

                var param = {};

                if (err){
                    log.error(seq + ': gmAPI get reverseGeocode faild- ' + err);

                    // Default value
                    country = 'Italy';
                    state = 'Emilia-Romagna';
                    city = 'Parma';

                    param = {
                        seq: seq,
                        latitude: latitude,
                        longitude: longitude,
                        country: country,
                        state: state,
                        city: city,
                        done: done,
                        allKeyword: allKeyword,
                        batchAnnCount: batchAnnCount,
                        annRemains: annRemains
                    };

                    parseSensorCallback(param);

                } else {
                    if (result.status == 'OK'){
                        result.results[0].address_components.forEach(function (component) {
                            component.types.forEach(function (type) {

                                if (type == "country") country = component.long_name;
                                if (type == "administrative_area_level_1") state = component.long_name;
                                if (type == "locality") city = component.long_name;
                            })
                        });
                    } else {

                        // Default value
                        country = 'Italy';
                        state = 'Emilia-Romagna';
                        city = 'Parma';
                    }

                    param = {
                        seq: seq,
                        latitude: latitude,
                        longitude: longitude,
                        country: country,
                        state: state,
                        city: city,
                        done: done,
                        allKeyword: allKeyword,
                        batchAnnCount: batchAnnCount,
                        annRemains: annRemains
                    };

                    parseSensorCallback(param);
                }
            });

        });
    } else {
        var param = {
            seq: seq,
            country: importSwitch.country,
            done: done,
            allKeyword: allKeyword,
            batchAnnCount: batchAnnCount,
            annRemains: annRemains
        };

        parseSensorCallback(param);
    }



}


function parseSensorCallback(param) {

    var country = param.country;
    var seq = param.seq;

    if (country == 'Italy') countryCode = "it";
    if (country == 'United States') countryCode = "us";
    if (country == 'Taiwan') countryCode = "tw";

    param.captureTime = seq.substring(9);

    if (importSwitch.parseSensorCallback){
        param.frameNum = ls(newArrived + "R/" + seq + '/*.raw').length;
    }else {
        param.frameNum = 900;
    }


    var title = seq.substring(11);
    title = title.replace(/:/g, "");
    param.title = title + "-" + countryCode;

    genThumb(param);
}


function genThumb(param) {

    log.info(param.title + ': genThumb');

    var seq = param.seq;

    if (importSwitch.genThumb){
        exec('ffmpeg -i ' + newArrived + 'L/' + seq + '/video_h264.mp4 -ss 00:00:03.000 -vframes 1 -vf scale=-1:100 ' + newArrived + 'L/' + seq + '/temp_thumb.jpg',{silent:true});
        exec('ffmpeg -i ' + newArrived + 'L/' + seq + '/temp_thumb.jpg -vframes 1 -vf crop=100:100 ' + newArrived + 'L/' + seq + '/thumb.jpg', {silent:true});
        rm(newArrived + 'L/' + seq + '/temp_thumb.jpg');
    }

    setupFolder(param);

}


function setupFolder(param) {

    var title = param.title;
    var seq = param.seq;

    log.info(title + ': setupFolder');

    if (importSwitch.setupFolder){
        mkdir('-p', seqRoot + title + '/Front_Stereo/L/raw');
        mkdir('-p', seqRoot + title + '/Front_Stereo/R/raw');
        mkdir('-p', seqRoot + title + '/Front_Stereo/L/metadata');
        mkdir('-p', seqRoot + title + '/Front_Stereo/R/metadata');
        mkdir('-p', seqRoot + title + '/Front_Stereo/L/yuv');
        mkdir('-p', seqRoot + title + '/Front_Stereo/R/yuv');
        mkdir('-p', seqRoot + title + '/Front_Stereo/annotation');

        mv(newArrived + 'R/' + seq + '/OtherSensors*', seqRoot + title + '/' + title + '_Sensor');
        mv(newArrived + 'L/' + seq + '/thumb.jpg', seqRoot + title + '/');
        mv(newArrived + 'L/' + seq + '/video_h264.mp4', seqRoot + title + '/Front_Stereo/L/' + title + '_h264_L.mp4');
        mv(newArrived + 'R/' + seq + '/video_h264.mp4', seqRoot + title + '/Front_Stereo/R/' + title + '_h264_R.mp4');
        mv(newArrived + 'L/' + seq + '/*.raw', seqRoot + title + '/Front_Stereo/L/raw/');
        mv(newArrived + 'R/' + seq + '/*.raw', seqRoot + title + '/Front_Stereo/R/raw/');
        mv(newArrived + 'L/' + seq + '/*.bin', seqRoot + title + '/Front_Stereo/L/metadata/');
        mv(newArrived + 'R/' + seq + '/*.bin', seqRoot + title + '/Front_Stereo/R/metadata/');

        mv(newArrived + 'L/' + seq + '/cali_data', seqRoot + title + '/Front_Stereo/L/');
        mv(newArrived + 'R/' + seq + '/cali_data', seqRoot + title + '/Front_Stereo/R/');

        cd(seqRoot + title);
        exec('tar -cf ' + title + '_Sensor.tar ' + title + '_Sensor');
        cd(currentPath);
        // rm('-r', seqRoot + title + '/' + title + '_Sensor');
        rm('-r', newArrived + 'R/' + seq);
        rm('-r', newArrived + 'L/' + seq);
    }

    parseMeta(param);

}


function parseMeta(param) {

    var title = param.title;
    log.info(title + ': parseMeta');

    var metaPathL = seqRoot + title + '/Front_Stereo/L/metadata/';
    var metaPathR = seqRoot + title + '/Front_Stereo/R/metadata/';

    if (importSwitch.parseMeta){
        exec('meta_parser -f ' + metaPathL + 'md_arm.bin -s ' + metaPathL + 'md_ucode_0000000000.bin -o ' + seqRoot + title + '/Front_Stereo/L/' + title + '_meta_L.txt', {silent:true});
        exec('meta_parser -f ' + metaPathR + 'md_arm.bin -s ' + metaPathR + 'md_ucode_0000000000.bin -o ' + seqRoot + title + '/Front_Stereo/R/' + title + '_meta_R.txt', {silent:true});
    }

    insertDB(param);
}


function insertDB(param) {

    log.info(param.title + ': insertDB');

    var keywords = [];
    for (var i = 0; i < param.allKeyword.length; i++){
        if (param.allKeyword[i].title == param.title) {
            keywords = param.allKeyword[i].keywords;
            break;
        }
    }

    var Sequence = {
        title: param.title,
        location: {country: param.country, state: param.state, city: param.city},
        keywords: keywords,
        gps: {x: param.latitude, y: param.longitude},
        avg_speed: 0,
        capture_time: param.captureTime,
        frame_number: param.frameNum,
        usage: "Training",
        file_location: [{site: "us", root_path: "/vol1/" + param.title}, {site: "it", root_path: ""}],
        no_annotation: false,
        cameras: [
            {
                name: "Front_Stereo",
                is_stereo: true,
                yuv: [],
                annotation: [
                    {
                        category: "moving_object",
                        fps: 10,
                        priority: 3,
                        state: 'Pending',
                        version: [{version_number: 1, comments: "Initial request"}]
                    },
                    {
                        category: "free_space_with_curb",
                        fps: 1,
                        priority: 3,
                        state: 'Pending',
                        version: [{version_number: 1, comments: "Initial request"}]
                    }
                ]
            }
        ],
        version: 4
    };

    if (importSwitch.insertDB){

        var options = {
            url: insertURL,
            json: true,
            body: Sequence,
            timeout: 1000000
        };

        request.post(options, function(error, response, body) {
            // log.debug('import body: ', body, 'error: ', error);

            if ( error ) {
                log.error(param.title + 'Import DB post failed: ', error);
            }
            else {
                if ( response.statusCode == 200 ) {
                    log.info(param.title + 'Import DB success: ', body);

                    var decompress_job = queue.create('decompress', {
                        sequenceObj: Sequence,
                        batchAnnCount: param.batchAnnCount,
                        annRemains: param.annRemains
                    });

                    decompress_job.save();

                    param.done(null, 'import_new_done');

                }
                else {
                    log.error(param.title + 'Import DB response failed, response.statusCode: ', response.statusCode);
                }
            }
        });
    } else {
        var decompress_job = queue.create('decompress', {
            sequenceObj: Sequence,
            batchAnnCount: param.batchAnnCount,
            annRemains: param.annRemains
        });

        decompress_job.save();

        param.done(null, 'import_new_done');
    }



}


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

    if (importSwitch.decompress){
        var seq = job.data.sequenceObj;
        var frameNum = seq.frame_number;
        var rightRawDir = '/mnt/supercam/' + seq.title + '/Front_Stereo/R/raw';
        var leftRawDir = '/mnt/supercam/' + seq.title + '/Front_Stereo/L/raw';
        var divideFrame = parseInt(frameNum / THREADS);
        var startFrame = 0;
        var endFrame = divideFrame;
        var doneCount = 0;
        var failed = false;


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

                        var encode_job = queue.create('encode', {
                            sequenceObj: seq,
                            channel: 'left',
                            isInitEncode: true,
                            batchAnnCount: job.data.batchAnnCount,
                            annRemains: job.data.annRemains
                        });

                        encode_job.save();

                        encode_job = queue.create('encode', {
                            sequenceObj: seq,
                            channel: 'right',
                            isInitEncode: true,
                            batchAnnCount: job.data.batchAnnCount,
                            annRemains: job.data.annRemains
                        });

                        encode_job.save();

                        done(null, 'decompress_done');
                    }
                } else {
                    log.error("decompress sequence " + seq.title + ' failed. Exit code: ' + exitCode);

                    if (!failed){
                        failed = true;
                        var failed_decompress = queue.create('failed_decompress', {
                            sequenceObj: seq,
                            batchAnnCount: job.data.batchAnnCount,
                            annRemains: job.data.annRemains
                        });
                        done(null, 'decompress_done');
                    }

                }
            });

            decompressLeft.on('exit', function (exitCode) {
                // log.debug("Left child exited with code: " + exitCode);

                if (exitCode === 0){

                    // log.debug("Done decompress Left, doneCount: " + doneCount);
                    doneCount++;

                    if (doneCount == THREADS*2){
                        log.info("Done decompress sequence: " + seq.title);
                        log.info("End: " + new Date());

                        var encode_job = queue.create('encode', {
                            sequenceObj: seq,
                            channel: 'left',
                            isInitEncode: true,
                            batchAnnCount: job.data.batchAnnCount,
                            annRemains: job.data.annRemains
                        });

                        encode_job.save();

                        encode_job = queue.create('encode', {
                            sequenceObj: seq,
                            channel: 'right',
                            isInitEncode: true,
                            batchAnnCount: job.data.batchAnnCount,
                            annRemains: job.data.annRemains
                        });

                        encode_job.save();


                        done(null, 'decompress_done');
                    }
                } else {
                    log.error("decompress sequence " + seq.title + ' failed. Exit code: ' + exitCode);
                    if (!failed){
                        failed = true;
                        var failed_decompress = queue.create('failed_decompress', {
                            sequenceObj: seq,
                            batchAnnCount: job.data.batchAnnCount,
                            annRemains: job.data.annRemains
                        });
                        done(null, 'decompress_done');
                    }
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

    if(importSwitch.dewarp){

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

    if(importSwitch.cat){

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

    if(importSwitch.encode_HEVC){



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

    log.info("Processing genAnnotation: " + seq.title);

    if (importSwitch.genAnnotation){
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

        curSeqCount++;

        log.debug('curSeqCount: ', curSeqCount);

        if ((curSeqCount%30) == 0 || (batchAnnCount == 0 && (curSeqCount%30) == annRemains)){
            log.debug('tar whole batch');

            batchAnnCount--;

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
                versionNum: job.data.versionNum,
                batchAnnCount: job.data.batchAnnCount,
                annRemains: job.data.annRemains
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
                versionNum: job.data.versionNum,
                batchAnnCount: job.data.batchAnnCount,
                annRemains: job.data.annRemains
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

                var curSeqCount = 1;
                if (job.data.curSeqCount){
                    curSeqCount = job.data.curSeqCount++;
                }

                var genAnnotation = queue.create('genAnnotation', {
                    sequenceObj: job.data.sequenceObj,
                    batchAnnCount: job.data.batchAnnCount,
                    annRemains: job.data.annRemains,
                    curSeqCount: curSeqCount
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

    if (result === 'failed_decompress_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;


            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed failed_decompress job #%d', job.id);
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
