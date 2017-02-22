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
const log4js = require('log4js');
log4js.configure(require('./log_config.json').import_new);
const log = log4js.getLogger('import_new');
const fs = require('fs');
const config = require('./config');
const readline = require('readline');

var newArrived = config.newArrived;
var csvPath = config.csvPath;
var keyArr = config.keyArr;
var countryCode = config.countryCode;
var allKeyword = [];
var doIntegrityCheck = false;


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
