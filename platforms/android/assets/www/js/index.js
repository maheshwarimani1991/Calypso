/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        app.receivedEvent('deviceready');
        console.log(navigator.contacts);
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    }
   
};

app.initialize();

var contactImage;

function createContact(){
    $("#bdy").load("contactDetail.html", function(responseTxt, statusTxt, xhr){
        if(statusTxt == "success")
            console.log("Redirection successfull!");
        if(statusTxt == "error")
            alert("Error: " + xhr.status + ": " + xhr.statusText);
    });
}

function uploadPic(){
    console.log('Hello');

    var opt = { quality : 75,
      destinationType : Camera.DestinationType.FILE_URI,
      sourceType : Camera.PictureSourceType.CAMERA,
      allowEdit : true,
      encodingType: Camera.EncodingType.JPEG,
      targetWidth: 100,
      targetHeight: 100,
      popoverOptions: CameraPopoverOptions,
      saveToPhotoAlbum: false };

    navigator.camera.getPicture(onSuccess, onFail, opt);

    function onSuccess(imageData) {
        console.log(imageData);
        contactImage = imageData;
        var image = document.getElementById('img');
        //image.src = "data:image/jpeg;base64," + imageData;
        image.src = imageData;
    }

    function onFail(message) {
        alert('Failed because: ' + message);
    }
}

function Save(){
    console.log(contactImage);
    //alert('Creating Contact');
    // create a new contact object
    var contact = navigator.contacts.create();
    console.log(document.getElementById("fname").value);
    contact.displayName = document.getElementById("dname").value;
    contact.nickname = document.getElementById("nname").value;            // specify both to support all devices

    // populate some fields
    var name = new ContactName();
    name.givenName = document.getElementById("fname").value;
    name.familyName = document.getElementById("lname").value;
    contact.name = name;
    
    var phoneNo = [];
    phoneNo[0] = new ContactField('mobile', document.getElementById("mob").value, true); // preferred number
    contact.phoneNumbers = phoneNo;

    var email = [];
    email[0] = new ContactField('home', document.getElementById("eml").value);
    contact.emails = email;

    var pics = [];
    pics[0] = new ContactField('url',contactImage,true);
    //pics[0] = new ContactField('base64',"data:image/jpeg;base64,"+contactImage,true);
 //   pics[2] = new ContactField('url','https://i.warosu.org/data/tg/img/0343/52/1408995777537.jpg',true);
    //pics[1] = new ContactField('url','https://i.warosu.org/data/tg/img/0431/25/1445145743264.jpg');
    console.log(pics);
    contact.photos = pics;
    console.log('picssssssssssssssssssssssss');
    console.log(contact.photos);
        
    contact.save(onSuccess,onError);
    console.log(contact);
}

function onSuccess(contact) {
    alert("Contact Successfully Created");
    console.log(contact.photos);
    console.log(contact.id);
};

function onError(contactError) {
    alert("Error = " + contactError.code);
};

function retrieveContact(){
    // find all contacts with 'Bob' in any name field
    alert(document.getElementById("fname").value);
    var options      = new ContactFindOptions();
    options.filter   = document.getElementById("fname").value;
    options.multiple = true;
    options.desiredFields = [navigator.contacts.fieldType.id];
    var fields       = [navigator.contacts.fieldType.id, navigator.contacts.fieldType.displayName, navigator.contacts.fieldType.name];
    navigator.contacts.find(fields, onSuc, onErr, options);    
}
    
function onSuc(contacts) {
    alert('Found ' + contacts.length + ' contacts.');
    console.log(contacts);
    console.log(contacts[0].photos);
    console.log(contacts[0].id);
};

function onErr(contactError) {
    alert('onError!');
};