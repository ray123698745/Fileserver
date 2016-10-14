/**
 * Created by rayfang on 8/08/16.
 */
const kue = require('kue');
const spawn = require('child_process').spawn;
const log4js = require('log4js');
log4js.configure('log_config.json', { reloadSecs: 300 });
const log = log4js.getLogger('decompress_queue');
const queue = kue.createQueue({
    redis: {
        port: 6379,
        host: '10.1.3.32'
    }
});
require('shelljs/global');

const THREADS = 8;
const SITE = 'us';

var getRootPathBySite = function (siteArray) {

    for (var i=0; i < siteArray.length; i++) {
        if (siteArray[i].site === SITE) {
            return siteArray[i].root_path;
        }
    }
};


queue.process('decompress', function (job, done){


    log.info("Processing decompress: ", job.data.sequenceObj.title);
    log.info("Start: " + new Date());


    var seq = job.data.sequenceObj;
    var frameNum = seq.frame_number;
    var rightRawDir = '/mnt/supercam/' + seq.title + '/Front_Stereo/R/raw';
    var leftRawDir = '/mnt/supercam/' + seq.title + '/Front_Stereo/L/raw';
    var divideFrame = parseInt(frameNum / THREADS);
    var startFrame = 0;
    var endFrame = divideFrame;
    var doneCount = 0;



    // Todo: Change mount point on algo3 to be consistent with web server
    // var rightRawDir = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/R/raw';
    // var leftRawDir = '/mnt/supercam' + getRootPathBySite(seq.file_location) + '/Front_Stereo/L/raw';




    for (var i = 0; i < THREADS; i++){

        // log.debug('startFrame: ', startFrame);


        if (i === THREADS-1)
            endFrame = endFrame + (frameNum % THREADS);

        var decompressRight = spawn('./decompress/decompress.sh', [rightRawDir, rightRawDir, startFrame, endFrame-1]);
        var decompressLeft = spawn('./decompress/decompress.sh', [leftRawDir, leftRawDir, startFrame, endFrame-1]);


        // decompressRight.stdout.on('data',
        //     function (data) {
        //         // log.debug('right stdout: ' + data);
        //     }
        // );
        // decompressLeft.stdout.on('data',
        //     function (data) {
        //         // log.debug('left stdout: ' + data);
        //     }
        // );


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

                    done(null, 'decompress_done');
                }
            } else {
                log.error("decompress sequence " + seq.title + ' failed. Exit code: ' + exitCode);

                // Todo: should comment out donCount++
                // doneCount++;
                //
                // if (doneCount == THREADS*2){
                //     log.debug("Done decompress sequence: " + seq.title);
                //     done(null, 'decompress_done');
                // }
            }
        });

        decompressLeft.on('exit', function (exitCode) {
            // log.debug("Left child exited with code: " + exitCode);

            if (exitCode === 0){

                // log.debug("Done decompress Left, doneCount: " + doneCount);
                doneCount++;

                if (doneCount == THREADS*2){
                    log.info("Done decompress sequence: " + seq.title);
                    done(null, 'decompress_done');
                }
            } else {
                log.error("decompress sequence " + seq.title + ' failed. Exit code: ' + exitCode);

                // Todo: should comment out donCount++
                // doneCount++;
                //
                // if (doneCount == THREADS*2){
                //     log.debug("Done decompress sequence: " + seq.title);
                //     done(null, 'decompress_done');
                // }
            }
        });

        startFrame = startFrame + divideFrame;
        endFrame = endFrame + divideFrame;

    }

    // done(null, 'decompress_done');  // Todo: comment out this line


});

