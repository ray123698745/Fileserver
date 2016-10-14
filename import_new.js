/**
 * Created by cjfang on 7/25/16.
 */
const kue = require('kue');
const queue = kue.createQueue();
const express = require("express");
const bodyParser = require("body-parser");
const log4js = require('log4js');
log4js.configure('log_config.json', { reloadSecs: 300 });
const log = log4js.getLogger('import');
const app = express();
const fs = require('fs');
const request = require('request');
const path = require('./config');
const readline = require('readline');
const GoogleMapsAPI = require('googlemaps');
require('shelljs/global');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var newArrived = path.newArrived;
var seqRoot = path.seq;
var currentPath = pwd();
var url = 'http://localhost:3001/api/sequence/insertUnfiltered';

var server = app.listen(process.env.PORT || 3003, function () {
    log.info("File server listening on port %s...", server.address().port);
});

var publicConfig = {
    key: 'AIzaSyBKazcMqdk5t0mJcyv7lroFEKtLthpFaLg',
    stagger_time:       1000, // for elevationPath
    encode_polylines:   false,
    secure:             true // use https
    // proxy:              'http://127.0.0.1:9999' // optional, set a proxy for HTTP requests
};

var gmAPI = new GoogleMapsAPI(publicConfig);


fs.readdir(newArrived + "L/", function(err, seqs) {
    if (err){
        log.error(err);
    } else {
        log.debug(seqs);

        seqs.forEach(function(seq){

            if (seq.charAt(0) == 'S'){

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
                        seq: seq
                    });

                    import_new_job.save();

                } else {
                    log.error('Import: ' + seq + ' failed!');
                }

            }

        });
    }

});


queue.process('import_new', function (job, done){

    var seq = job.data.seq;
    parseSensor(seq, done);

});


function parseSensor(seq, done) {

    var fileName =  ls(newArrived + 'R/' + seq + '/OtherSensors*/*.mef');

    if (fileName.length == 0){
        log.error(seq +  " import failed: No OtherSensors");
    }
    var isClosed = false;

    var rl = readline.createInterface({

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
            "latlng":        latitude + "," + -longitude,
            "result_type":   "country|administrative_area_level_1|locality",
            "language":      "en",
            "location_type": "APPROXIMATE"
        };

        gmAPI.reverseGeocode(reverseGeocodeParams, function(err, result){

            if (err){
                log.error(seq + ': gmAPI get reverseGeocode faild- ' + err);
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

                //todo: testing-- change -longitude
                var param = {
                    seq: seq,
                    latitude: latitude,
                    longitude: -longitude,
                    country: country,
                    state: state,
                    city: city,
                    done: done
                };

                parseSensorCallback(param);
            }
        });

    });

}


function parseSensorCallback(param) {

    var country = param.country;
    var seq = param.seq;

    if (country == 'Italy') countryCode = "it";
    if (country == 'United States') countryCode = "us";
    if (country == 'Taiwan') countryCode = "tw";

    param.captureTime = seq.substring(9);
    param.frameNum = ls(newArrived + "R/" + seq + '/*.raw').length;
    var title = seq.substring(11);
    title = title.replace(/:/g, "");
    param.title = title + "-" + countryCode;

    genThumb(param);
}


function genThumb(param) {

    log.info(param.title + ': genThumb');

    var seq = param.seq;

    exec('ffmpeg -i ' + newArrived + 'L/' + seq + '/video_h264.mp4 -ss 00:00:03.000 -vframes 1 -vf scale=-1:100 ' + newArrived + 'L/' + seq + '/temp_thumb.jpg',{silent:true});
    exec('ffmpeg -i ' + newArrived + 'L/' + seq + '/temp_thumb.jpg -vframes 1 -vf crop=100:100 ' + newArrived + 'L/' + seq + '/thumb.jpg', {silent:true});
    rm(newArrived + 'L/' + seq + '/temp_thumb.jpg');

    setupFolder(param);

}


function setupFolder(param) {

    var title = param.title;
    var seq = param.seq;

    log.info(title + ': setupFolder');

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

    parseMeta(param);

}


function parseMeta(param) {

    var title = param.title;
    log.info(title + ': parseMeta');

    var metaPathL = seqRoot + title + '/Front_Stereo/L/metadata/';
    var metaPathR = seqRoot + title + '/Front_Stereo/R/metadata/';

    exec('meta_parser -f ' + metaPathL + 'md_arm.bin -s ' + metaPathL + 'md_ucode_0000000000.bin -o ' + seqRoot + title + '/Front_Stereo/L/' + title + '_meta_L.txt', {silent:true});
    exec('meta_parser -f ' + metaPathR + 'md_arm.bin -s ' + metaPathR + 'md_ucode_0000000000.bin -o ' + seqRoot + title + '/Front_Stereo/R/' + title + '_meta_R.txt', {silent:true});

    insertDB(param);
}


function insertDB(param) {


    log.info(param.title + ': insertDB');

    var unfilteredSequence = {
        title: param.title,
        location: {country: param.country, state: param.state, city: param.city},
        keywords: [],
        gps: {x: param.latitude, y: param.longitude},
        avg_speed: 0,
        capture_time: param.captureTime,
        frame_number: param.frameNum,
        usage: "Training",
        file_location: [{site: "us", root_path: "/vol1/" + param.title}, {site: "it", root_path: ""}],
        cameras: [
            {
                name: "Front_Stereo",
                is_stereo: true,
                yuv: [],
                annotation: []
            }
        ],
        version: 4
    };

    var options = {
        url: url,
        json: true,
        body: unfilteredSequence,
        timeout: 1000000
    };

    request.post(options, function(error, response, body) {
        // log.debug('import body: ', body, 'error: ', error);

        if ( error ) {
            log.error(param.title + '-Import DB post failed: ', error);
        }
        else {
            if ( response.statusCode == 200 ) {
                log.info(param.title + '-Import DB success: ', body);
                param.done(null, 'import_new_done');

            }
            else {
                log.error(param.title + 'Import DB response failed, response.statusCode: ', response.statusCode);
            }
        }
    });
}





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



});
