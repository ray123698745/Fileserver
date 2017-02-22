/**
 * Created by cjfang on 1/26/17.
 */

var importSwitch = {
    decompress: true
};


const kue = require('kue');
const queue = kue.createQueue({
    redis: {
        port: 6379,
        host: '10.1.3.32'
    }
});
const spawn = require('child_process').spawn;
const log4js = require('log4js');
log4js.configure(require('./log_config.json').decompress);
const log = log4js.getLogger('decompress');
const fs = require('fs');
const config = require('./config');
require('shelljs/global');


const THREADS = 8;


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
                            annRemains: job.data.annRemains,
                            curSeqCount: job.data.curSeqCount
                        });

                        encode_job.save();

                        encode_job = queue.create('encode', {
                            sequenceObj: seq,
                            channel: 'right',
                            isInitEncode: true,
                            batchAnnCount: job.data.batchAnnCount,
                            annRemains: job.data.annRemains,
                            curSeqCount: job.data.curSeqCount
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
                            annRemains: job.data.annRemains,
                            curSeqCount: job.data.curSeqCount
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
                            annRemains: job.data.annRemains,
                            curSeqCount: job.data.curSeqCount
                        });

                        encode_job.save();

                        encode_job = queue.create('encode', {
                            sequenceObj: seq,
                            channel: 'right',
                            isInitEncode: true,
                            batchAnnCount: job.data.batchAnnCount,
                            annRemains: job.data.annRemains,
                            curSeqCount: job.data.curSeqCount
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
                            annRemains: job.data.annRemains,
                            curSeqCount: job.data.curSeqCount
                        });
                        done(null, 'decompress_done');
                    }
                }
            });

            startFrame = startFrame + divideFrame;
            endFrame = endFrame + divideFrame;

        }

    } else {
        var encode_job = queue.create('encode', {
            sequenceObj: job.data.sequenceObj,
            channel: 'left',
            isInitEncode: true,
            batchAnnCount: job.data.batchAnnCount,
            annRemains: job.data.annRemains,
            curSeqCount: job.data.curSeqCount
        });

        encode_job.save();

        encode_job = queue.create('encode', {
            sequenceObj: job.data.sequenceObj,
            channel: 'right',
            isInitEncode: true,
            batchAnnCount: job.data.batchAnnCount,
            annRemains: job.data.annRemains,
            curSeqCount: job.data.curSeqCount
        });

        encode_job.save();
        done(null, 'decompress_done');
    }

});

