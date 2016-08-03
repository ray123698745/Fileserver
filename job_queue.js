/**
 * Created by rayfang on 6/27/16.
 */
var kue = require('kue');
//var telnet = require('telnet-client');
var queue = kue.createQueue();
//var connection = new telnet();
var spawn = require('child_process').spawn;

const EVKNUM = 3;

/*
var params = {
    host: '192.168.240.' + ip
    //port: 23,
    //shellPrompt: '/ # ',
    //timeout: 1500,
    // removeEcho: 4
};

var cmd = './raw_encode.sh /mnt/supercam/vol1/SuperCam-2016-06-08-07:28:54/Front_Stereo/L/decompressed_raw /mnt/supercam/vol1/SuperCam-2016-06-08-07:28:54/Front_Stereo/L/yuv/temp 1 10';

connection.on('ready', function(prompt) {
    connection.exec(cmd, function(err, response) {
        console.log(response);
        if(err)
            console.log(response);
    });
});

connection.on('timeout', function() {
    console.log('socket timeout!')
    connection.end();
});

connection.on('close', function() {
    console.log('connection closed');
});

connection.connect(params);
*/

queue.process('processImport', function (job, done){
    
});

queue.process('encode', function (job, done){


    console.log('Processing encode');
    console.log('input: ' + job.data.inputPath);
    console.log('output: ' + job.data.outputPath);
    console.log('frameNum: ' + job.data.frameNum);
    console.log('ituner: ' + job.data.ituner);

    var frameNum = job.data.frameNum;
    // var frameNum = 50;

    var inputPath = job.data.inputPath;
    var outputPath = job.data.outputPath;
    var ituner = job.data.ituner;


    // add raw_encode script loop and distribute frames

    var divideFrame = parseInt(frameNum / EVKNUM);
    var startFrame = 0;
    var doneCount = 0;

    for (var i = 0; i < EVKNUM; i++){

        ip = 9 + (EVKNUM - i);

        if (i === EVKNUM-1)
            divideFrame = divideFrame + (frameNum % EVKNUM);

        console.log('command: ' + 'time ./raw_encode.sh /mnt/supercam' + inputPath + ' /mnt/supercam' + outputPath + " " + startFrame + " " + divideFrame + ' 192.168.240.' + ip);


        var child = spawn('ruby',
                ['telnet.rb', 'time ./raw_encode.sh /mnt/supercam' + inputPath + ' /mnt/supercam' + outputPath + " " + startFrame + " " + divideFrame, '192.168.240.' + ip]);

        child.stdout.on('data',
            function (data) {
                console.log('stdout: ' + data);
            }
        );

        child.stderr.on('data',
            function (data) {
                console.log('stderr: ' + data);
            }
        );


        child.on('exit', function (exitCode) {
            console.log("Child exited with code: " + exitCode);

            if (exitCode === 0){

                console.log("Done encode");
                doneCount++;

                if (doneCount == EVKNUM)
                    done(null, 'encode_done');

            }

        });


        startFrame = startFrame + divideFrame;
    }

});




queue.on('job enqueue', function(id, type){
    console.log( 'Job %s got queued of type %s', id, type );

}).on('job complete', function(id, result){


    if (result === 'encode_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;

            var db_job = queue.create('update_db', {
                path: job.data.path,
                ituner: job.data.ituner
            });

            db_job.save();

            job.remove(function(err){
                if (err) throw err;
                console.log('removed completed encode job #%d', job.id);
            });
        });
    }

    if (result === 'update_db_done'){

        kue.Job.get(id, function(err, job){
            if (err) return;


            job.remove(function(err){
                if (err) throw err;
                console.log('removed completed db job #%d', job.id);
            });
        });

    }


});
