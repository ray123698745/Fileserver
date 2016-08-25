/**
 * Created by cjfang on 8/22/16.
 */
const readline = require('readline');
const fs = require('fs');
const GoogleMapsAPI = require('googlemaps');
require('shelljs/global');


var fileName =  ls('/supercam/vol1/16-08-03-071110-it/16-08-03-071110-it_Sensor/test*.mef');


var rl = readline.createInterface({

    input: fs.createReadStream(fileName[0])
});


var publicConfig = {
    key: 'AIzaSyBKazcMqdk5t0mJcyv7lroFEKtLthpFaLg',
    stagger_time:       1000, // for elevationPath
    encode_polylines:   false,
    secure:             true // use https
    // proxy:              'http://127.0.0.1:9999' // optional, set a proxy for HTTP requests
};

var gmAPI = new GoogleMapsAPI(publicConfig);
var latitude = "";
var longitude = "";
var latitudePos = 0;
var longitudePos = 0;
var altitudePos = 0;
var country = "";
var state = "";
var city = "";
var isClosed = false;

rl.on('line', function(line){

    latitudePos = line.search('latitude');
    longitudePos = line.search(',longitude');
    altitudePos = line.search(',altitude');

    if (latitudePos != -1 && !isClosed){

        // console.log('line:' + line);


        latitudePos = latitudePos + 9;

        latitude = line.substring(latitudePos, latitudePos + (longitudePos - latitudePos));

        longitudePos = longitudePos + 11;
        longitude = line.substring(longitudePos, longitudePos +  (altitudePos - longitudePos));

        rl.close();
        isClosed = true;
    }
}).on('close', function () {

    var reverseGeocodeParams = {
        // "latlng":        latitude + "," + longitude,
        "latlng":        "44.798544,10.331290",
        "result_type":   "country|administrative_area_level_1|locality",
        "language":      "en",
        "location_type": "APPROXIMATE"
    };

    gmAPI.reverseGeocode(reverseGeocodeParams, function(err, result){
        // console.log(result.results[0].address_components[3].long_name);
        // console.log(result.results[0]);


        result.results[0].address_components.forEach(function (component) {
           component.types.forEach(function (type) {
               // console.log('type:' + type);

               if (type == "country") country = component.long_name;
               if (type == "administrative_area_level_1") state = component.long_name;
               if (type == "locality") city = component.long_name;
           })
        });

        afterCallback();

    });

    console.log('closed!!!');
});

function afterCallback() {
    console.log("country: " + country + ", state: " + state + ", city: " + city);
}
