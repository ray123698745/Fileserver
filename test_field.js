/**
 * Created by cjfang on 8/22/16.
 */
const readline = require('readline');
const fs = require('fs');
// const ini = require('ini');

const GoogleMapsAPI = require('googlemaps');

const log4js = require('log4js');
log4js.configure('log_config.json', { reloadSecs: 300 });
const log = log4js.getLogger('test_field');
require('shelljs/global');




var version_number = 2;
var uploadTime = "2016-11-03T04:57:21.204Z";
var comments = "new comment!";

var jsonFile = fs.readFileSync('/supercam/vol1/test_field/old_json.json', 'utf-8');



if (jsonFile.search('\"metadata\"') != -1){
    var jsonObj = JSON.parse(jsonFile);

    jsonObj.metadata["annotation-version"] = version_number;
    jsonObj.metadata["upload_time"] = uploadTime;

    if(!jsonObj.metadata.comments.v1){
        var tempComment = jsonObj.metadata.comments;
        jsonObj.metadata.comments = {};
        var tempKey = 'v' + (version_number-1);
        jsonObj.metadata.comments[tempKey] = tempComment
    }
    var versionKey = 'v' + version_number;
    jsonObj.metadata.comments[versionKey] = comments;


    log.debug('jsonObj: ', jsonObj.metadata);
}

// var metadataPos = jsonFile.search('{')+1;
//
// var metadata = '\n \"metadata\":\n {\n  \"annotation-version\":\"' + version_number + '\",\n  ' + '\"upload_time\":\"' + uploadTime + '\",\n  ' + '\"comments\":\"' + comments + '\",\n  ' + '\"fps\":\"' + fps + '\"\n },';
//
// var addMetadata = jsonFile.substring(0, metadataPos) + metadata + jsonFile.substring(metadataPos);
//

var jsonResult = JSON.stringify(jsonObj, null, 1);

fs.writeFileSync('/supercam/vol1/test_field/json_back.json', jsonResult, 'utf-8');



















// Todo: read & import keyword from csv
var keyArr = ["Sunny", "Rain", "Cloudy", "Snow", "Hail", "Bright", "Indoor", "Shadow", "Night_with_street_light",  "Night_without_street_light", "Dusk", "Dawn", "Back_lit", "Tunnel"];
//
// var seqObj = {};
//
// var rl = readline.createInterface({
//
//     input: fs.createReadStream('/supercam/vol1/test_field/sequence_tag.csv')
// });
//
//
//
// rl.on('line', function(line){
//
//     if(line.charAt(0) == 'S'){
//         // log.debug(line);
//
//         var title = line.substring(0, 28);
//         log.debug('title: ', title);
//
//         var content = line.substring(29);
//         content = content.replace(/,/g, "");
//
//         // log.debug('content: ', content);
//
//         var tempArr = [];
//
//         for(var i = 0; i < content.length; i++){
//             if (content[i] == 1)
//                 tempArr.push(keyArr[i]);
//         }
//
//         log.debug('tempArr: ', tempArr);
//
//         seqObj[title] = tempArr;
//     }
//
//
// }).on('close', function () {
//     log.debug('seqObj: ', seqObj);
//
//     log.debug('closed');
// });






















// fs.readdir('/supercam/vol1/new_arrived/L', function(err, seqs) {
//     if (err){
//         log.error(err);
//     } else {
//         log.debug(seqs);
//
//         seqs.forEach(function(seq) {
//
//             if (seq.charAt(0) == 'S'){
//
//                 cp('/supercam/vol1/test_field/Right.ini', '/supercam/vol1/new_arrived/R/' + seq + '/cali_data/Right.ini');
//
//             }
//         });
//
//         log.debug('done!');
//
//     }
// });




























// var inputPath = '/home/cjfang/Fileserver-dev/yuv_test/org/';
// var outputPath = '/home/cjfang/Fileserver-dev/yuv_test/resample/';
// var width = 640;
// var height = 480;
// var frameNum = 10 - 1;
//
// var cmd = './supercam_convert.tcsh ' + inputPath + ' ' + outputPath + ' ' + width + ' ' + height + ' ' + frameNum;
//
// exec(cmd, {async:true}, function (code, stdout, stderr) {
//
//     if (code == 0)
//         log.debug('Done!');
//
// });





















// var batchPath = "/supercam/vol1/annotation/tasks_batch/temp/";
//
//
//

//
// var queries = [];
//
//
// for (var i = 0; i < 62; i++){
//
//     queries.push(i);
// }
//
// var batchSequenceCount = queries.length;
// var parts = 1;
// var remains = batchSequenceCount;
//
// if(queries.length > 30){
//     parts = parseInt(queries.length / 30)+1;
//     remains = queries.length % 30;
//     batchSequenceCount = 30;
// }
//
//
// for (var i = 0; i < parts; i++){
//
//     if (i == parts-1) batchSequenceCount = remains;
//
//     for (var j = 0; j < batchSequenceCount; j++){
//
//         log.debug("queries[j]: " + queries[j+(30*i)]);
//
//         // if (parts > 1){
//         //
//         //
//         // } else {
//         //
//         //     log.debug("queries[j]: " + queries[j]);
//         // }
//
//
//         log.debug("batchSequenceCount: " + (batchSequenceCount - j));
//     }
// }

//
// batchSequenceCount = queries.length;
//
// for (var j = 0; j < queries.length; j++){
//
//     log.debug("queries[j]: " + queries[j]);
//
//
//     log.debug("batchSequenceCount: " + (batchSequenceCount - j));
//
// }












// var statFile = JSON.parse(fs.readFileSync('/supercam/vol1/16-08-02-160759-it/Front_Stereo/annotation/moving_object_v1/16-08-02-160759-it_moving_object_stat.json', 'utf-8'));
//
// var set_obj = {};
// var classes_key = 'test_obj';
// set_obj[classes_key] = [];
//
// for (var i = 0; i < statFile.class_count.length; i++){
//
//     set_obj[classes_key][i] = [];
//     set_obj[classes_key][i][0] = statFile.class_count[i][0];
//     set_obj[classes_key][i][1] = statFile.class_count[i][1];
// }
//
// log.debug("staeFile: " + statFile.class_count[0][0]);





















// mkdir(batchPath + '../' + 'testBatch');
// mv(batchPath + '*', batchPath + '../' + 'testBatch');
//



// var batchSequenceCount = 30;
// var parts = 1;
// var remains = 30;
// var queryLength = 62;
//
// if(queryLength > 30){
//     parts = parseInt(queryLength / 30)+1;
//     remains = queryLength % 30;
// }
//
// log.debug('parts: ' + parts);
// log.debug('remains: ' + remains);
//
//
// for (var i = 0; i < parts; i++){
//
//     if (i == parts-1) batchSequenceCount = remains;
//
//     for (var j = 0; j < batchSequenceCount; j++){
//
//         log.debug('batchSequenceCount - j: ' + (batchSequenceCount - j));
//
//
//     }
// }







//
// var cali_ini = fs.readFileSync('/supercam/vol1/annotation/tasks_batch/Left.ini', 'utf-8');
//
// var cali_ini_1 = cali_ini.substring(0, cali_ini.search('OPTICAL CENTER') + 17);
//
//
// var sub_cali_ini = cali_ini.substring(cali_ini.search('OPTICAL CENTER') + 17);
// var opticalCenterX = sub_cali_ini.substring(0, sub_cali_ini.search(','));
//
//
// sub_cali_ini = sub_cali_ini.substring(sub_cali_ini.search(',')+2);
// var opticalCenterY = sub_cali_ini.substring(0, sub_cali_ini.search('\t'));
// var cali_ini_2 = sub_cali_ini.substring(sub_cali_ini.search('\t'), sub_cali_ini.search('PIXEL FOCAL LENGTH'));
//
// sub_cali_ini = sub_cali_ini.substring(sub_cali_ini.search('PIXEL FOCAL LENGTH')+21);
// var focalLengthX = sub_cali_ini.substring(0, sub_cali_ini.search(','));
//
// sub_cali_ini = sub_cali_ini.substring(sub_cali_ini.search(',')+2);
// var focalLengthY = sub_cali_ini.substring(0, sub_cali_ini.search('\t'));
// var cali_ini_3 = sub_cali_ini.substring(sub_cali_ini.search('\t'));
//
// sub_cali_ini = sub_cali_ini.substring(sub_cali_ini.search('\t'));
//
//
// cali_ini = cali_ini_1 + opticalCenterX/2 + ', ' + opticalCenterY/2 + cali_ini_2 + 'PIXEL FOCAL LENGTH = ' + focalLengthX/2 + ', ' + focalLengthY/2 + cali_ini_3;
//
// log.debug(cali_ini);
// log.debug(opticalCenterY);





























// var fileName =  ls('/supercam/vol1/16-08-03-071110-it/16-08-03-071110-it_Sensor/test*.mef');
//
//
// var rl = readline.createInterface({
//
//     input: fs.createReadStream(fileName[0])
// });
//
//
// var publicConfig = {
//     key: 'AIzaSyBKazcMqdk5t0mJcyv7lroFEKtLthpFaLg',
//     stagger_time:       1000, // for elevationPath
//     encode_polylines:   false,
//     secure:             true // use https
//     // proxy:              'http://127.0.0.1:9999' // optional, set a proxy for HTTP requests
// };
//
// var gmAPI = new GoogleMapsAPI(publicConfig);
// var latitude = "";
// var longitude = "";
// var latitudePos = 0;
// var longitudePos = 0;
// var altitudePos = 0;
// var country = "";
// var state = "";
// var city = "";
// var isClosed = false;
//
// rl.on('line', function(line){
//
//     latitudePos = line.search('latitude');
//     longitudePos = line.search(',longitude');
//     altitudePos = line.search(',altitude');
//
//     if (latitudePos != -1 && !isClosed){
//
//         // console.log('line:' + line);
//
//
//         latitudePos = latitudePos + 9;
//
//         latitude = line.substring(latitudePos, latitudePos + (longitudePos - latitudePos));
//
//         longitudePos = longitudePos + 11;
//         longitude = line.substring(longitudePos, longitudePos +  (altitudePos - longitudePos));
//
//         rl.close();
//         isClosed = true;
//     }
// }).on('close', function () {
//
//     var reverseGeocodeParams = {
//         // "latlng":        latitude + "," + longitude,
//         "latlng":        "44.798544,10.331290",
//         "result_type":   "country|administrative_area_level_1|locality",
//         "language":      "en",
//         "location_type": "APPROXIMATE"
//     };

    // gmAPI.reverseGeocode(reverseGeocodeParams, function(err, result){
    //     // console.log(result.results[0].address_components[3].long_name);
    //     // console.log(result.results[0]);
    //
    //
    //     result.results[0].address_components.forEach(function (component) {
    //        component.types.forEach(function (type) {
    //            console.log('type:' + type);
    //
    //            if (type == "country") country = component.long_name;
    //            if (type == "administrative_area_level_1") state = component.long_name;
    //            if (type == "locality") city = component.long_name;
    //        })
    //     });
    //
    //     afterCallback();
    //
    // });

    // console.log('closed!!!');

    // for (var i = 0; i < 100; i++){
//         log.debug('closed!');
//         log.error('test error!');
//
//
//
// });

// function afterCallback() {
//     // console.log("country: " + country + ", state: " + state + ", city: " + city);
// }
