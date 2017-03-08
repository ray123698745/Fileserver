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
const log4js = require('log4js');
log4js.configure(require('./log_config.json').job_monitor);
const log = log4js.getLogger('job_monitor');

queue.on('job enqueue', function(id, type){

    log.info('Job %s got queued of type %s', id, type );

}).on('job complete', function(id, result){

    if (result === 'init_seq_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed init_seq job #%d', job.id);
            });

        });
    }

    if (result === 'decompress_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;


            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed decompress job #%d', job.id);
            });

        });
    }

    if (result === 'encode_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed encode job #%d', job.id);
            });
        });
    }

    if (result === 'dewarp_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed dewarp job #%d', job.id);
            });

        });
    }

    if (result === 'cat_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed cat job #%d', job.id);
            });

        });
    }

    if (result === 'encode_HEVC_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed encode_HEVC job #%d', job.id);
            });
        });

    }

    if (result === 'genPreviewImg_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;

            job.remove(function(err){
                if (err) throw err;
                log.info('removed completed genPreviewImg job #%d', job.id);
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
