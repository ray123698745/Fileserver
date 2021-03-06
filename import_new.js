/**
 * Created by cjfang on 7/25/16.
 */
const kue = require('kue');
const queue = kue.createQueue({
    redis: {
        port: 6379,
        host: '10.1.3.32'
    }
});

const fs = require('fs');
const config = require('./config');
const readline = require('readline');
var newArrived = config.newArrived;
var csvPath = config.csvPath;
var keyArr = config.keyArr;
var countryCode = config.countryCode;
var volume = config.volume;

var log_config = (volume === 'vol1' || volume === 'vol2') ? './log_config_1.json' :'./log_config_3.json';
const log4js = require('log4js');
log4js.configure(require(log_config).import_new);
const log = log4js.getLogger('import_new');

var allKeyword = [];
var doIntegrityCheck = false;
var queryUrl = 'http://localhost:3000/api/sequence/query';
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const request = require('request');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
require('shelljs/global');
const SITE = 'us';

var init_job = (volume === 'vol1' || volume === 'vol2') ? 'init_job_1' :'init_job_3';
var port = (volume === 'vol1' || volume === 'vol2') ? 3006 :3016;

log.debug('init_job:', init_job);


var server = app.listen(process.env.PORT || port, function () {
    log.info("File server listening on port %s...", server.address().port);
});


// genKeywords();
addSemiAnnotation();


var getRootPathBySite = function (siteArray) {

    for (var i=0; i < siteArray.length; i++) {
        if (siteArray[i].site === SITE) {
            return siteArray[i].root_path;
        }
    }
};


function addSemiAnnotation() {

    batchName = "US-4";

    query = { version: 5,
        "batchNum.country": "US",
        "batchNum.num": 4
    };



    var options = {
        url: queryUrl,
        json: true,
        body: query,
        timeout: 1000000
    };

    request.post(options, function(error, response, body) {
        // log.debug('update path response', response, 'body', body, 'error', error);
        // log.debug('body: ', body, 'error: ', error);

        if ( error ) {
            log.error('query DB failed', error);
        }
        else {
            if ( response.statusCode == 200 ) {
                log.debug('query success', body.length);

                // var batchAnnCount = parseInt(body.length / 30);
                var batchAnnCount = body.length;

                // var annRemains = body.length % 30;
                var curSeqCount = 0;


                for (var i = 0; i < body.length; i++){


                    log.debug('title:', body[i].title);

                    curSeqCount++;

                    mkdir('/supercam' + getRootPathBySite(body[i].file_location) + '/Front_Stereo/annotation/moving_object_init/');
                    cp('/supercam/vol1/test_field/init_json/' + body[i].batchNum.country + '-' + body[i].batchNum.num + '/' + body[i].title + '_moving_object.json','/supercam' + getRootPathBySite(body[i].file_location) + '/Front_Stereo/annotation/moving_object_init/');


                    var genSemiAnnotation = queue.create('genSemiAnnotation', {
                        sequenceObj: body[i],
                        batchAnnCount: batchAnnCount,
                        annRemains: 0,
                        curSeqCount: curSeqCount,
                        batchName: batchName
                    });

                    genSemiAnnotation.save();
                }
            }
            else {
                log.error('query failed', response.statusCode);
            }
        }
    });
}


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
            log.debug('parsedTitle:', parsedTitle);
            log.debug('tempArr:', tempArr);


        }


    }).on('close', function () {

        log.debug('closed');


        fs.readdir(newArrived + "L/", function(err, seqs) {
            if (err){
                log.error(err);
            } else {

                mkdir(newArrived + "L/removed");
                mkdir(newArrived + "R/removed");

                for (var i = 0; i < seqs.length; i++){
                    if(seqs[i].charAt(0) == 'S'){

                        var removed = true;
                        var title = seqs[i].substring(0, 28);
                        var parsedTitle = title.substring(11);
                        parsedTitle = parsedTitle.replace(/:/g, "");
                        parsedTitle = parsedTitle + "-" + countryCode;

                        for (var j = 0; j < allKeyword.length; j++){
                            if (allKeyword[j].title == parsedTitle) {
                                removed = false;
                                log.info('Import: ' + title);

                                var init_seq = queue.create(init_job, {
                                    seq: seqs[i],
                                    allKeyword :allKeyword,
                                    batchAnnCount: 0,
                                    annRemains: 0,
                                    curSeqCount: 0
                                });
                                init_seq.save();

                                break;
                            }
                        }

                        if (removed){
                            log.debug("removed:", seqs[i]);
                            mv(newArrived + "L/" + seqs[i], newArrived + "L/removed");
                            mv(newArrived + "R/" + seqs[i], newArrived + "R/removed");
                        }
                    }
                }

                // integrityCheck();

            }}
        );

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
            var curSeqCount = 0;

            seqs.forEach(function(seq){

                if (seq.charAt(0) == 'S'){

                    curSeqCount++;

                    if ((curSeqCount%30) == 0) {
                        batchAnnCount--;
                    }

                        if (doIntegrityCheck){

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

                            var init_seq = queue.create('init_seq', {
                                seq: seq,
                                allKeyword :allKeyword,
                                batchAnnCount: batchAnnCount,
                                annRemains: annRemains,
                                curSeqCount: curSeqCount
                            });

                            init_seq.save();

                        } else {
                            log.error('Import: ' + seq + ' failed!');
                        }
                    } else {
                        log.info('Import: ' + seq);

                        var init_seq = queue.create('init_seq', {
                            seq: seq,
                            allKeyword :allKeyword,
                            batchAnnCount: batchAnnCount,
                            annRemains: annRemains,
                            curSeqCount: curSeqCount

                        });

                        init_seq.save();
                    }
                }
            });
        }

    });
}
