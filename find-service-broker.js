var express = require("express");
var bodyParser = require("body-parser");
var app = express();
var log = require('log4js').getLogger('cf');

//FIXME: hardcode this for now
const PEAXY_AWS_IP = '52.202.119.134';
const PEAXY_AWS = 'https://' + PEAXY_AWS_IP;
const PEAXY_USR = 'admin';
const PEAXY_PWD = 'Admin123';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

 
var server = app.listen(process.env.PORT || 3000, function () {
    log.debug("Aureum Find Service Broker listening on port %s...", server.address().port);
});

// catalog
app.get('/v2/catalog', function(req, res) {
	
	log.debug('catalog request headers', req.headers);
	
	var plans = [
	    {id: 'beta', name: 'Beta', description: 'beta cluster'},
	];
	
	tags = ['peaxy', 'aureum', 'posix', 'hdfs', 'search'];
	
	meta = {
		displayName: 'Peaxy Aureum Find Service',
		someOtherMeta: 'etc'
	};
	
	// service definition
	var sd = {
	    id: 'aureumfind',
	    name: 'aureumfind',
	    description: 'Aureum Find Service',
	    bindable: true,
	    plans: plans,
	    tags: tags,
	    metadata: meta
	};
	
	res.send({services: [sd]} );
});

// provisioning
app.put('/v2/service_instances/:instance_id', function(req, res) {
	log.debug('service provisioning request with instance id', req.params.instance_id);
	log.debug('provision with req data', req.body);
	
	res.status(201);
	var url = {dashboard_url: PEAXY_AWS};
	res.send(url);
});

// de-provisioning
app.delete('/v2/service_instances/:instance_id', function(req, res) {
	log.debug('service de-provisioning request with instance id', req.params.instance_id);
	log.debug('de-provision with req data', req.body);
	
	res.status(200);
	res.send({});
});

// binding
app.put('/v2/service_instances/:instance_id/service_bindings/:binding_id', function(req, res) {
	log.debug('service binding request with instance id', req.params.instance_id, 'binding id', req.params.binding_id);
	log.debug('binding with req data', req.body);
	
	res.status(201);
	
	var credential = {
		host: PEAXY_AWS_IP,
		username: PEAXY_USR,
		password: PEAXY_PWD
	};
	
	var body = {credentials: credential};
	res.send(body);
});

// unbinding
app.delete('/v2/service_instances/:instance_id/service_bindings/:binding_id', function(req, res) {
	log.debug('service unbinding request with instance id', req.params.instance_id, 'binding id', req.params.binding_id);
	log.debug('unbinding with req query', req.query);
	
	res.status(200);
	var body = {}
	res.send(body);
});
