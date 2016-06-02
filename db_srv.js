/**
 * Created by rayfang on 5/30/16.
 */
var express = require("express");
var bodyParser = require("body-parser");
var app = express();
var log = require('log4js').getLogger('db');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


var server = app.listen(process.env.PORT || 3002, function () {
    log.debug("DB server listening on port %s...", server.address().port);
});

app.put('/api/fpath', function(req, res) {
    var path = req.body;
    log.debug('got update', path);
    res.status(200);
    res.send({res: 'ok'});
});

