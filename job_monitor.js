/**
 * Created by cjfang on 1/26/17.
 */

const kue = require('kue');
const queue = kue.createQueue({
    redis: {
        port: 6379,
        host: '10.1.3.32'
    }
});

const config = require('./config');
var volume = config.volume;

var log_config = (volume === 'vol1' || volume === 'vol2') ? './log_config_1.json' :'./log_config_3.json';
const log4js = require('log4js');
log4js.configure(require(log_config).job_monitor);
const log = log4js.getLogger('job_monitor');

var init_job_done = (volume === 'vol1' || volume === 'vol2') ? 'init_job_1_done' :'init_job_3_done';
var decompress_job_done = (volume === 'vol1' || volume === 'vol2') ? 'decompress_job_1_done' :'decompress_job_3_done';
var encode_job_done = (volume === 'vol1' || volume === 'vol2') ? 'encode_job_1_done' :'encode_job_3_done';
var dewarp_job_done = (volume === 'vol1' || volume === 'vol2') ? 'dewarp_job_1_done' :'dewarp_job_3_done';
var cat_job_done = (volume === 'vol1' || volume === 'vol2') ? 'cat_job_1_done' :'cat_job_3_done';
var HEVC_job_done = (volume === 'vol1' || volume === 'vol2') ? 'HEVC_job_1_done' :'HEVC_job_3_done';
var genPreviewImg_job_done = (volume === 'vol1' || volume === 'vol2') ? 'genPreviewImg_job_1_done' :'genPreviewImg_job_3_done';


queue.on('job enqueue', function(id, type){

    log.info('Job %s got queued of type %s', id, type );

}).on('job complete', function(id, result){

    if (result === init_job_done){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info(init_job_done + ' #%d', job.id);
            });

        });
    }

    if (result === decompress_job_done){

        kue.Job.get(id, function(err, job){
            if (err) return;


            job.remove(function(err){
                if (err) throw err;
                log.info(decompress_job_done + ' #%d', job.id);
            });

        });
    }

    if (result === encode_job_done){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info(encode_job_done + ' #%d', job.id);
            });
        });
    }

    if (result === dewarp_job_done){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info(dewarp_job_done + ' #%d', job.id);
            });

        });
    }

    if (result === cat_job_done){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info(cat_job_done + ' #%d', job.id);
            });

        });
    }

    if (result === HEVC_job_done){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info(HEVC_job_done + ' #%d', job.id);
            });
        });

    }

    if (result === genPreviewImg_job_done){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info(genPreviewImg_job_done + ' #%d', job.id);
            });
        });

    }

    if (result === 'genAnnotation_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;

            // var disparity_job = queue.create('disparity', {
            //     sequenceObj: job.data.sequenceObj
            // });
            //
            // disparity_job.save();

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed genAnnotation job #%d', job.id);
            });

        });
    }

    if (result === 'genSemiAnnotation_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;

            // var disparity_job = queue.create('disparity', {
            //     sequenceObj: job.data.sequenceObj
            // });
            //
            // disparity_job.save();

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed genSemiAnnotation job #%d', job.id);
            });

        });
    }

    if (result === 'failed_decompress_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;


            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed failed_decompress job #%d', job.id);
            });

        });
    }
    // if (result === 'tar_yuv_done'){
    //
    //     kue.Job.get(id, function(err, job){
    //         if (err) return;
    //
    //
    //         job.remove(function(err){
    //             if (err) throw err;
    //             log.info('removed completed tar_yuv job #%d', job.id);
    //         });
    //     });
    //
    // }

});
