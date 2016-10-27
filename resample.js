/**
 * Created by cjfang on 10/27/16.
 */
const kue = require('kue');
const queue = kue.createQueue();
const spawn = require('child_process').spawn;
const log4js = require('log4js');
log4js.configure('log_config.json', { reloadSecs: 300 });
const log = log4js.getLogger('job_queue');
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const fs = require('fs');
const request = require('request');
require('shelljs/global');
var batchURL = 'http://localhost:3001/api/annotation/insertBatch';




app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


var server = app.listen(process.env.PORT || 3005, function () {
    log.info("File server listening on port %s...", server.address().port);
});



queue.process('processSequence', function (job, done){
    
    
    
});
