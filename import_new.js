/**
 * Created by cjfang on 7/25/16.
 */
const express = require("express");
const bodyParser = require("body-parser");
const log = require('log4js').getLogger('import');
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
// var url = 'http://localhost:3000/api/sequence/insertUnfiltered';
var url = 'http://localhost:3001/api/sequence/insertUnfiltered';
var frameNum = 0;
var captureTime = "";
var country = "";
var countryCode = "";
var state = "";
var city = "";
var title = "";
var latitude = "";
var longitude = "";


var server = app.listen(process.env.PORT || 3003, function () {
    log.debug("File server listening on port %s...", server.address().port);
});

var publicConfig = {
    key: 'AIzaSyBKazcMqdk5t0mJcyv7lroFEKtLthpFaLg',
    stagger_time:       1000, // for elevationPath
    encode_polylines:   false,
    secure:             true // use https
    // proxy:              'http://127.0.0.1:9999' // optional, set a proxy for HTTP requests
};

var gmAPI = new GoogleMapsAPI(publicConfig);


function parseSensor(seq) {


    var fileName =  ls(newArrived + 'L/OtherSensor-Acq/OtherSensor-' + seq.substring(9, 25) + '/test*.mef');
    var isClosed = false;

    var rl = readline.createInterface({

        input: fs.createReadStream(fileName[0])
    });




    var latitudePos = 0;
    var longitudePos = 0;
    var altitudePos = 0;

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


        var reverseGeocodeParams = {
            "latlng":        latitude + "," + longitude,
            "result_type":   "country|administrative_area_level_1|locality",
            "language":      "en",
            "location_type": "APPROXIMATE"
        };

        gmAPI.reverseGeocode(reverseGeocodeParams, function(err, result){
            // console.log(result.results[0].address_components[3].long_name);
            // console.log(result);

            if (result.status == 'OK'){
                result.results[0].address_components.forEach(function (component) {
                    component.types.forEach(function (type) {
                        // console.log('type:' + type);

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




            parseSensorCallback(seq);

        });

    });




}


function parseSensorCallback(seq) {

    console.log("country: " + country + ", state: " + state + ", city: " + city);

    if (country == 'Italy') countryCode = "it";
    if (country == 'United States') countryCode = "us";
    if (country == 'Taiwan') countryCode = "tw";


    captureTime = seq.substring(9);
    frameNum = ls(newArrived + "R/" + seq + '/*.raw').length;
    title = seq.substring(11);
    title = title.replace(/:/g, "");
    title = title + "-" + countryCode;


    genThumb(seq);
    setupFolder(seq);
    parseMeta();
    insertDB(title, captureTime,frameNum, country, state, city, latitude, longitude);

    log.debug('Done: ' + title);
}


function genThumb(seq) {

    exec('ffmpeg -i ' + newArrived + 'L/' + seq + '/video_h264.mp4 -ss 00:00:03.000 -vframes 1 -vf scale=-1:100 ' + newArrived + 'L/' + seq + '/temp_thumb.jpg');
    exec('ffmpeg -i ' + newArrived + 'L/' + seq + '/temp_thumb.jpg -vframes 1 -vf crop=100:100 ' + newArrived + 'L/' + seq + '/thumb.jpg');
    rm(newArrived + 'L/' + seq + '/temp_thumb.jpg');

    log.debug('thumbnail generated!');
}


function setupFolder(seq) {

    mkdir('-p', seqRoot + title + '/Front_Stereo/L/raw');
    mkdir('-p', seqRoot + title + '/Front_Stereo/R/raw');
    mkdir('-p', seqRoot + title + '/Front_Stereo/L/metadata');
    mkdir('-p', seqRoot + title + '/Front_Stereo/R/metadata');
    mkdir('-p', seqRoot + title + '/Front_Stereo/L/yuv');
    mkdir('-p', seqRoot + title + '/Front_Stereo/R/yuv');
    mkdir('-p', seqRoot + title + '/Front_Stereo/annotation');

    //Todo: change to mv
    // cp('-r', newArrived + 'L/OtherSensor-Acq/OtherSensor-' + seq.substring(9, 25), seqRoot + title + '/' + title + '_Sensor');
    mv(newArrived + 'L/OtherSensor-Acq/OtherSensor-' + seq.substring(9, 25), seqRoot + title + '/' + title + '_Sensor');
    mv(newArrived + 'L/' + seq + '/thumb.jpg', seqRoot + title + '/');
    mv(newArrived + 'L/' + seq + '/video_h264.mp4', seqRoot + title + '/Front_Stereo/L/' + title + '_h264_L.mp4');
    mv(newArrived + 'R/' + seq + '/video_h264.mp4', seqRoot + title + '/Front_Stereo/R/' + title + '_h264_R.mp4');
    mv(newArrived + 'L/' + seq + '/*.raw', seqRoot + title + '/Front_Stereo/L/raw/');
    mv(newArrived + 'R/' + seq + '/*.raw', seqRoot + title + '/Front_Stereo/R/raw/');
    mv(newArrived + 'L/' + seq + '/*.bin', seqRoot + title + '/Front_Stereo/L/metadata/');
    mv(newArrived + 'R/' + seq + '/*.bin', seqRoot + title + '/Front_Stereo/R/metadata/');

    cd(seqRoot + title);
    exec('tar -cf ' + title + '_Sensor.tar ' + title + '_Sensor');
    cd(currentPath);
    // rm('-r', seqRoot + title + '/' + title + '_Sensor');
    rm('-r', newArrived + 'R/' + seq);
    rm('-r', newArrived + 'L/' + seq);
}


function parseMeta() {

    var metaPathL = seqRoot + title + '/Front_Stereo/L/metadata/';
    var metaPathR = seqRoot + title + '/Front_Stereo/R/metadata/';

    exec('meta_parser -f ' + metaPathL + 'md_arm.bin -s ' + metaPathL + 'md_ucode_0000000000.bin -o ' + seqRoot + title + '/Front_Stereo/L/' + title + '_meta_L.txt');
    exec('meta_parser -f ' + metaPathR + 'md_arm.bin -s ' + metaPathR + 'md_ucode_0000000000.bin -o ' + seqRoot + title + '/Front_Stereo/R/' + title + '_meta_R.txt');
}


function insertDB(title, captureTime, frameNum, country, state, city, latitude, longitude) {

    log.debug("insertDB");

    var unfilteredSequence = {
        title: title,
        location: {country: country, state: state, city: city},
        keywords: [],
        gps: {x: latitude, y:longitude},
        avg_speed: 0,
        capture_time: captureTime,
        frame_number: frameNum,
        usage: "Training",
        file_location: [{site: "us", root_path: "/vol1/" + title}, {site: "it", root_path: ""}],
        cameras: [
            {
                name: "Front_Stereo",
                is_stereo: true,
                yuv: [],
                annotation: []
            }
        ]
    };

    var options = {
        url: url,
        json: true,
        body: unfilteredSequence,
        timeout: 1500
    };

    request.put(options, function(error, response, body) {
        // log.debug('import body: ', body, 'error: ', error);

        if ( error ) {
            log.error('Import DB put failed: ', error);
        }
        else {
            if ( response.statusCode == 200 ) {
                log.debug('Import DB success: ', body);
            }
            else {
                log.error('Import DB response failed, response.statusCode: ', response.statusCode);
            }
        }
    });
}


fs.readdir(newArrived + "L/", function(err, seqs) {
    if (err){
        log.debug(err);
    } else {
        log.debug(seqs);

        seqs.forEach(function(seq){
            // if (seq.charAt(0) == 'Z'){
            if (seq.charAt(0) == 'S'){

                log.debug('Importing: ' + seq);

                parseSensor(seq);

            }

        });
    }

});



