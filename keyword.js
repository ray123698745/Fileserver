/**
 * Created by cjfang on 12/6/16.
 */
const readline = require('readline');
const fs = require('fs');
// const ini = require('ini');

const GoogleMapsAPI = require('googlemaps');

const log4js = require('log4js');
log4js.configure('log_config.json', { reloadSecs: 300 });
const log = log4js.getLogger('test_field');
require('shelljs/global');
const express = require("express");
const bodyParser = require("body-parser");
const request = require('request');

const app = express();
var url = 'http://localhost:3000/api/sequence/updateUnfiltered';



app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


var server = app.listen(process.env.PORT || 30022, function () {
    log.info("File server listening on port %s...", server.address().port);
});






// Todo: read & import keyword from csv
var keyArr = ['Sunny','Rain','Cloudy','Snow','Hail','Bright','Indoor','Shadow','Night_with_street_light','Night_without_street_light','Dusk','Dawn','Back_lit','Tunnel','Urban','Suburban','Rural','Highway','Parking_lot','Full_lane_marking','Center_lane_only','No_lane_Marking','Special_lane_Marking','Accident','Pot_hole','No_vehicle','Few_vehicle','More_vehicle','Special_vehicle','No_Pedestrian','Few_Pedestrian','More_Pedestrian','Special_Pedestrian','Construction', 'Intersection', 'Round_about'];

var queries = [];
var countryCode = "tw";

var rl = readline.createInterface({

    input: fs.createReadStream('/supercam/vol1/test_field/tag_csv/Import_with_Tag_ssd1_TW-5_20170109.csv')
});



rl.on('line', function(line){

    if(line.charAt(0) == 'S'){
        // log.debug(line);

        var title = line.substring(0, 28);
        var parsedTitle = title.substring(11);
        parsedTitle = parsedTitle.replace(/:/g, "");
        parsedTitle = parsedTitle + "-" + countryCode;
        log.debug('parsedTitle: ', parsedTitle);



        var content = line.substring(29);
        content = content.replace(/,/g, "");

        // log.debug('content: ', content);

        var tempArr = [];

        for(var i = 0; i < keyArr.length; i++){
            if (content[i] == 1)
                tempArr.push(keyArr[i]);
        }

        // if(content[keyArr.length] == 1)
        //     log.debug('need annotation');
        // if(content[keyArr.length+1] != null){
        //     log.debug('note:', content.substring(keyArr.length+1));
        // }

        log.debug('tempArr: ', tempArr);

        queries.push({
            condition: {title: parsedTitle},
            update: {$set: {"keywords": tempArr}},
            options: {multi: false}
        });



    }


}).on('close', function () {


    log.debug('queries: ', queries);


    var options = {
        url: url,
        json: true,
        body: queries,
        timeout: 1000000
    };

    request.post(options, function(error, response, body) {
        // log.debug('import body: ', body, 'error: ', error);

        if ( error ) {
            log.error('Import keywords post failed: ', error);
        }
        else {
            if ( response.statusCode == 200 ) {
                log.info('Import keywords success: ', body);

            }
            else {
                log.error('Import keywords response failed, response.statusCode: ', response.statusCode);
            }
        }
    });

    log.debug('closed');
});
