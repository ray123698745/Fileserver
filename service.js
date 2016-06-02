var express = require("express");
var bodyParser = require("body-parser");
var app = express();
var log = require('log4js').getLogger('find-srv');
var request = require('request');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('res'));

// ignore self-signed cert checking
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var sess_token;
 
var server = app.listen(process.env.PORT || 3000, function () {
    log.debug("Listening on port %s...", server.address().port);
});

app.put('/login', function(req, res) {
	var creds = get_credential();
	if ( creds ) {
		var url = 'https://'+ creds.host + '/hfapi/aaa/user/login';
		var user = {name: creds.username, password: creds.password};
		var options = {
		    url: url,
		    json: true,
		    body: user,
		    timeout: 1500
		};
		log.debug('login to', url);
		request.put(options, function(error, response, body) {
			log.debug('login response', response, 'body', body, 'error', error);
			if ( error ) {
				log.error('login failed', error);
				res.status(501);
			}
			else {
				if ( response.statusCode == 200 ) {
					log.debug('login success');
					log.debug('hf-token', body.token);
					sess_token = body.token;
					res.status(200);
				}
				else {
					log.error('login failed', response.statusCode);
					log.debug(body);
					res.status(401);
				}				
			}
		});
		res.send({})
	}
	else {
		log.error('returning bad login request');
		res.status(400);
		res.send({})
	}
});

app.put('/logout', function(req, res) {
	if ( sess_token ) {
		var creds = get_credential();
		var url = 'https://'+ creds.host + '/hfapi/aaa/user/logout';
		request.post(url)
		res.status(200);		
	}
	else {
		log.debug('no session');
		res.status(200);
	}
	res.send({})
})

app.get('/search/:domain/:query', function(req, res) {
	if ( sess_token) {
		var creds = get_credential();
		log.debug(req.params, 'q',  req.query);
		var url = 'https://'+ creds.host + '/solr/' + req.params.domain + '/select?&q=' + req.params.query;
		log.debug('searching url', url);
		res.status(200);
	}
	else {
		log.error('no session');
		res.status(200);
	}	
	res.send({})
})

var get_credential = function() {
	var vcap_services = process.env.VCAP_SERVICES;
	if ( vcap_services ) {
		vcap = JSON.parse(vcap_services);
		var aureumfind = vcap.aureumfind;
		if ( aureumfind ) {
			var creds = aureumfind[0].credentials;
			return creds;
		}
	}
	
	log.error('no environment variables, vcap services not bound or app was not restaged');
	return null;
}