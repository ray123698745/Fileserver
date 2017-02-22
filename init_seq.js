/**
 * Created by cjfang on 1/26/17.
 */
var importSwitch = {
    parseSensor: true,
    country: 'Italy',
    parseSensorCallback: true,
    genThumb: true,
    setupFolder: true,
    parseMeta: true
};


const kue = require('kue');
const queue = kue.createQueue({
    redis: {
        port: 6379,
        host: '10.1.3.32'
    }
});
const log4js = require('log4js');
// log4js.configure('log_config.json'.init, { reloadSecs: 300 });
log4js.configure(require('./log_config.json').init_seq);
const log = log4js.getLogger('init_seq');
const fs = require('fs');
const request = require('request');
const config = require('./config');
const readline = require('readline');
const GoogleMapsAPI = require('googlemaps');
require('shelljs/global');



var newArrived = config.newArrived;
var seqRoot = config.seq;
var countryCode = config.countryCode;
var batchNum = config.batchNum;


var currentPath = pwd();

var publicConfig = {
    key: 'AIzaSyBKazcMqdk5t0mJcyv7lroFEKtLthpFaLg',
    stagger_time:       1000, // for elevationPath
    encode_polylines:   false,
    secure:             true // use https
    // proxy:              'http://127.0.0.1:9999' // optional, set a proxy for HTTP requests
};
var gmAPI = new GoogleMapsAPI(publicConfig);

queue.process('init_seq', function (job, done){

    parseSensor(job.data.seq, done, job.data.allKeyword, job.data.batchAnnCount, job.data.annRemains, job.data.curSeqCount);

});


function parseSensor(seq, done, allKeyword, batchAnnCount, annRemains, curSeqCount) {

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
                        annRemains: annRemains,
                        curSeqCount: curSeqCount
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
                        annRemains: annRemains,
                        curSeqCount: curSeqCount
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
            annRemains: annRemains,
            curSeqCount: curSeqCount
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
    // var metaPathL = seqRoot + title + '/Front_Stereo/L/metadata/';
    // var metaPathR = seqRoot + title + '/Front_Stereo/R/metadata/';

    if (importSwitch.parseMeta){
        exec('meta_parser -f ' + metaPathL + 'md_arm.bin -s ' + metaPathL + 'md_ucode_0000000000.bin -o ' + seqRoot + title + '/Front_Stereo/L/' + title + '_meta_L.txt', {silent:false});
        exec('meta_parser -f ' + metaPathR + 'md_arm.bin -s ' + metaPathR + 'md_ucode_0000000000.bin -o ' + seqRoot + title + '/Front_Stereo/R/' + title + '_meta_R.txt', {silent:false});
        // exec('meta_parser -f ' + newArrived + 'L/test/' + param.seq + '/md_arm.bin -s ' + newArrived + 'L/test/' + param.seq + '/md_ucode_0000000000.bin -o ' + seqRoot + 'test_field/meta_L.txt', {silent:false});
        // exec('meta_parser -f ' + newArrived + 'L/test/' + param.seq + '/md_arm.bin -s ' + newArrived + 'L/test/' + param.seq + '/md_ucode_0000000000.bin -o ' + seqRoot + 'test_field/meta_R.txt', {silent:false});
    }

    CreateDBRecord(param);
}


function CreateDBRecord(param) {

    log.info(param.title + ': Create DB record');

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
        frame_number: 900,
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
                        fps: 5,
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
        version: 4,
        batchNum: batchNum
    };

    var decompress_job = queue.create('decompress', {
        sequenceObj: Sequence,
        batchAnnCount: param.batchAnnCount,
        annRemains: param.annRemains,
        curSeqCount: param.curSeqCount
    });

    decompress_job.save();


    param.done(null, 'init_seq_done');



}
