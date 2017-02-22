/**
 * Created by cjfang on 8/22/16.
 */
const readline = require('readline');
const fs = require('fs');
// const ini = require('ini');

const GoogleMapsAPI = require('googlemaps');

const log4js = require('log4js');
log4js.configure(require('./log_config.json').decompress);
const log = log4js.getLogger('test_field');
require('shelljs/global');
const express = require("express");
const bodyParser = require("body-parser");
const request = require('request');
const kue = require('kue');
const queue = kue.createQueue();
const config = require('./config');

const app = express();
var url = 'http://localhost:3000/api/sequence/updateUnfiltered';
var queryUrl = 'http://localhost:3000/api/sequence/query';


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// var server = app.listen(process.env.PORT || 3020, function () {
//     log.info("File server listening on port %s...", server.address().port);
// });


var csvPath = config.csvPath;
var keyArr = config.keyArr;
var countryCode = config.countryCode;
var allKeyword = [];

genKeywords();



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
            parsedTitle = parsedTitle + "-it";

            var content = line.substring(29);
            content = content.replace(/,/g, "");
            content = content.replace(/ /g, "");


            var tempArr = [];

            for(var i = 0; i < keyArr.length; i++){
                if (content[i] == 1)
                    tempArr.push(keyArr[i]);
            }

            allKeyword.push({
                title: parsedTitle,
                keywords: tempArr
            });
            // log.debug('content', content);
            // log.debug('parsedTitle', parsedTitle);


            if (parsedTitle == '17-01-11-150734-it') {
                log.debug('content', content);

                log.debug('tempArr', tempArr);
            }

        }


    }).on('close', function () {


        log.debug('closed');

        // for (var i = 0; i < allKeyword.length; i++){
        //     if (allKeyword[i].title == '17-01-11-150734-it') {
        //         log.debug('keywords', allKeyword[i].keywords);
        //         break;
        //     }
        // }

    });

}













// var seq = {
//     title: "17-02-15-115100-us",
//
//     version: 4,
//     batchNum: require('./config').batchNum
// };
//

// var key = "location.country";

// var options = {
//     url: "http://10.1.3.32:3000/api/sequence/query",
//     json: true,
//     body: {"location.country":"Taiwan"},
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
//             log.debug('Insert success', body.length);
//
//             var count = 0;
//             for (var i = 0; i < body.length; i++){
//                 if (body[i].gps.y < 0){
//                     // log.debug('Insert success', body.length);
//                     count++;
//
//                     var queries = {
//                         condition: {_id: body[i]._id},
//                         update: {$set: {"gps.y": -body[i].gps.y}},
//                         options: {multi: false}
//                     };
//
//                     var options = {
//                         url: "http://10.1.3.32:3000/api/sequence/update",
//                         json: true,
//                         body: queries,
//                         timeout: 1000000
//                     };
//
//                     request.post(options, function(error, response, body) {
//                         // log.debug('update path response', response, 'body', body, 'error', error);
//                         // log.debug('body: ', body, 'error: ', error);
//
//                         if ( error ) {
//                             log.error('update DB failed', error);
//
//
//                         }
//                         else {
//                             if ( response.statusCode == 200 ) {
//                                 log.debug('update success', body);
//                             }
//                             else {
//                                 log.error('Insert failed', response.statusCode);
//                             }
//                         }
//                     });
//
//
//
//
//                 }
//             }
//             log.debug('count', count);
//
//
//
//
//         }
//         else {
//             log.error('Insert failed', response.statusCode);
//         }
//     }
// });



//
// var testing_seq = ['16-09-16-163729-us', '16-10-22-103658-tw', '16-10-22-144618-tw', '16-11-04-074711-tw', '16-11-04-163158-tw', '16-11-14-074717-tw', '16-11-14-075645-tw', '16-11-14-082050-tw', '16-11-14-135323-tw', '16-11-14-140644-tw', '16-11-21-144313-tw', '16-11-21-144403-tw', '16-11-21-152240-tw', '16-11-21-155049-tw', '16-11-23-104901-tw', '16-11-24-160400-tw'];
//
//
//
//
//
// for (var i = 0; i < testing_seq.length; i++){
//
//     mkdir('/dump/algo2/Ray/test_sequence/' + testing_seq[i]);
//
//     cp('/supercam/vol1/test_field/re_encode/' + testing_seq[i] + '/Front_Stereo/R/yuv/' + testing_seq[i] + '_yuv_v1_R/*.yuv', '/dump/algo2/Ray/test_sequence/' + testing_seq[i]);
//
//     log.debug(testing_seq[i], 'done');
//
// }
//
// log.debug('done');




















// query = { version: 4,
//     no_annotation: false,
//     '$or':
//         [ { 'cameras.0.annotation': { '$elemMatch': { category: 'moving_object', state: 'Accepted' } } },
//             { 'cameras.0.annotation': { '$elemMatch': { category: 'moving_object', state: 'Finished' } } },
//             { 'cameras.0.annotation': { '$elemMatch': { category: 'moving_object', state: 'Finished_Basic' } } } ] };
//
//
//
// var options = {
//     url: queryUrl,
//     json: true,
//     body: query,
//     timeout: 1000000
// };
//
// request.post(options, function(error, response, body) {
//     // log.debug('update path response', response, 'body', body, 'error', error);
//     // log.debug('body: ', body, 'error: ', error);
//
//     if ( error ) {
//         log.error('query DB failed', error);
//     }
//     else {
//         if ( response.statusCode == 200 ) {
//             log.debug('query success');
//
//             for (var i = 0; i < body.length; i++){
//
//                 mv('/supercam/vol1/' + body[i].title + '/Front_Stereo/R/yuv/' + body[i].title + '_h265_v1.mp4', '/supercam/vol1/' + body[i].title + '/Front_Stereo/R/yuv/' + body[i].title + '_h265_v1_R.mp4');
//
//
//                 // var untar_job = queue.create('untar', {
//                 //     sequenceObj: body[i]
//                 // });
//                 //
//                 // untar_job.save();
//
//             }
//
//         }
//         else {
//             log.error('query failed', response.statusCode);
//         }
//     }
// });



//
//
// queue.process('untar', function (job, done){
//
//
//     log.info("Processing untar: ", job.data.sequenceObj.title);
//     log.info("Start: " + new Date());
//
//
//     var seq = job.data.sequenceObj;
//
//     done(null, 'untar_done');
//
//
// });
//
// queue.process('cat', function (job, done){
//
//
//     log.info("Processing cat: ", job.data.sequenceObj.title);
//     log.info("Start: " + new Date());
//
//
//     var seq = job.data.sequenceObj;
//
//     done(null, 'cat_done');
//
//
// });
//
// queue.process('encode_HEVC', function (job, done){
//
//
//     log.info("Processing encode_HEVC: ", job.data.sequenceObj.title);
//     log.info("Start: " + new Date());
//
//
//     var seq = job.data.sequenceObj;
//
//     done(null, 'encode_HEVC_done');
//
//
// });
//
//
//
//
// queue.on('job enqueue', function(id, type){
//
//     log.info('Job %s got queued of type %s', id, type );
//
// }).on('job complete', function(id, result){
//
//     if (result === 'untar_done'){
//
//         kue.Job.get(id, function(err, job){
//             if (err) return;
//
//
//             var cat_job = queue.create('cat', {
//                 sequenceObj: job.data.sequenceObj
//             });
//
//             cat_job.save();
//
//             job.remove(function(err){
//                 if (err) throw err;
//                 log.info('removed completed untar job #%d', job.id);
//             });
//
//         });
//     }
//
//     if (result === 'cat_done'){
//
//         kue.Job.get(id, function(err, job){
//             if (err) return;
//
//
//             var encode_HEVC_job = queue.create('encode_HEVC', {
//                 sequenceObj: job.data.sequenceObj
//             });
//
//             encode_HEVC_job.save();
//
//             job.remove(function(err){
//                 if (err) throw err;
//                 log.info('removed completed cat job #%d', job.id);
//             });
//
//         });
//     }
//
//
//
//     if (result === 'encode_HEVC_done'){
//
//         kue.Job.get(id, function(err, job){
//             if (err) return;
//
//
//             job.remove(function(err){
//                 if (err) throw err;
//                 log.info('removed completed encode_HEVC job #%d', job.id);
//             });
//         });
//
//     }
//
//
// });















//
// var arr = ['Sunny', 'Bright', 'Shadow','Night_with_street_light'];
// var selected = ['Sunny', 'Bright'];
//
//
// if(arr.indexOf('asd') > -1){
//     log.debug('true!');
// } else {
//     log.debug('false!');
// }
//
// var sumOfCode = function (str) {
//
//     var sum = 0;
//
//     for (var i = 0; i < str.length; i++){
//         sum += str.charCodeAt(i);
//     }
//
//     log.debug('sum:', sum);
//
//     return sum;
// };
//
//
// var a = "2016-05-21T00:01:00.000Z";
// var b = "2017-10-30T00:32:00.000Z";
// var c = "2017-10-31T00:32:00.000Z";
// var d = "2017-10-31T00:33:00.000Z";
//
// var day1 = new Date(c);
// var day2 = new Date(d);



// sumOfCode(a);
// sumOfCode(b);
// sumOfCode(c);
// sumOfCode(d);


// log.debug(day2.getTime());

// log.debug(a.localeCompare(b));



// var arr = [1, 2, 3, 4];
// var selected = ['Sunny', 'Bright'];
//
// if(3 in arr){
//     log.debug('true!');
// } else {
//     log.debug('false!')
// }















// fs.readdir('/dump/algo1/Ray/ssd_2', function(err, seqs) {
//     if (err){
//         log.error(err);
//     } else {
//         log.debug(seqs);
//
//         var count = 1;
//         seqs.forEach(function(seq) {
//
//             if (seq.charAt(0) == 'S'){
//
//                 mv('/dump/algo1/Ray/ssd_2/'+seq+'/f_0000000000.yuv', '/dump/algo1/Ray/ssd_2/' + count + '.yuv');
//                 count++;
//             }
//         });
//
//         log.debug('done!');
//
//     }
// });



























//
// // Todo: read & import keyword from csv
// var keyArr = ['Sunny','Rain','Cloudy','Snow','Hail','Bright','Indoor','Shadow','Night_with_street_light','Night_without_street_light','Dusk','Dawn','Back_lit','Tunnel','Urban','Suburban','Rural','Highway','Parking_lot','Full_lane_marking','Center_lane_only','No_lane_Marking','Special_lane_Marking','Accident','Pot_hole','No_vehicle','Few_vehicle','More_vehicle','Special_vehicle','No_Pedestrian','Few_Pedestrian','More_Pedestrian','Construction', 'Intersection', 'Round_about'];
//
// var queries = [];
// var countryCode = "tw";
//
// var rl = readline.createInterface({
//
//     input: fs.createReadStream('/supercam/vol1/test_field/keyword_v1.csv')
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
//         var parsedTitle = title.substring(11);
//         parsedTitle = parsedTitle.replace(/:/g, "");
//         parsedTitle = parsedTitle + "-" + countryCode;
//         log.debug('parsedTitle: ', parsedTitle);
//
//
//
//         var content = line.substring(29);
//         content = content.replace(/,/g, "");
//
//         // log.debug('content: ', content);
//
//         var tempArr = [];
//
//         for(var i = 0; i < keyArr.length; i++){
//             if (content[i] == 1)
//                 tempArr.push(keyArr[i]);
//         }
//
//         if(content[keyArr.length] == 1)
//             log.debug('need annotation');
//         if(content[keyArr.length+1] != null){
//             log.debug('note:', content.substring(keyArr.length+1));
//         }
//
//         log.debug('tempArr: ', tempArr);
//
//         queries.push({
//             condition: {title: parsedTitle},
//             update: {$set: {"keywords": tempArr}},
//             options: {multi: false}
//         });
//
//
//
//     }
//
//
// }).on('close', function () {
//
//
//     // log.debug('queries: ', queries);
//
//
//     // var options = {
//     //     url: url,
//     //     json: true,
//     //     body: queries,
//     //     timeout: 1000000
//     // };
//     //
//     // request.post(options, function(error, response, body) {
//     //     // log.debug('import body: ', body, 'error: ', error);
//     //
//     //     if ( error ) {
//     //         log.error('Import keywords post failed: ', error);
//     //     }
//     //     else {
//     //         if ( response.statusCode == 200 ) {
//     //             log.info('Import keywords success: ', body);
//     //
//     //         }
//     //         else {
//     //             log.error('Import keywords response failed, response.statusCode: ', response.statusCode);
//     //         }
//     //     }
//     // });
//
//     log.debug('closed');
// });























//
// var version_number = 2;
// var uploadTime = "2016-11-03T04:57:21.204Z";
// var comments = "new comment!";
//
// var jsonFile = fs.readFileSync('/supercam/vol1/test_field/old_json.json', 'utf-8');
//
//
//
// if (jsonFile.search('\"metadata\"') != -1){
//     var jsonObj = JSON.parse(jsonFile);
//
//     jsonObj.metadata["annotation-version"] = version_number;
//     jsonObj.metadata["upload_time"] = uploadTime;
//
//     if(!jsonObj.metadata.comments.v1){
//         var tempComment = jsonObj.metadata.comments;
//         jsonObj.metadata.comments = {};
//         var tempKey = 'v' + (version_number-1);
//         jsonObj.metadata.comments[tempKey] = tempComment
//     }
//     var versionKey = 'v' + version_number;
//     jsonObj.metadata.comments[versionKey] = comments;
//
//
//     log.debug('jsonObj: ', jsonObj.metadata);
// }
//
// // var metadataPos = jsonFile.search('{')+1;
// //
// // var metadata = '\n \"metadata\":\n {\n  \"annotation-version\":\"' + version_number + '\",\n  ' + '\"upload_time\":\"' + uploadTime + '\",\n  ' + '\"comments\":\"' + comments + '\",\n  ' + '\"fps\":\"' + fps + '\"\n },';
// //
// // var addMetadata = jsonFile.substring(0, metadataPos) + metadata + jsonFile.substring(metadataPos);
// //
//
// var jsonResult = JSON.stringify(jsonObj, null, 1);
//
// fs.writeFileSync('/supercam/vol1/test_field/json_back.json', jsonResult, 'utf-8');






















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
