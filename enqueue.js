var fs = require('fs');
var readline = require('readline');
var {google} = require('googleapis');
// var googleAuth = require('google-auth-library');
var atob = require('atob');

var Client = require('node-rest-client').Client;
var client = new Client();

const amqplib = require('amqplib/callback_api');
const config = require('./config');

var Cryptr = require('cryptr'),
    cryptr = new Cryptr('Ji5RW2BlJ6');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/gmail-nodejs-quickstart.json
var SCOPES = ['https://mail.google.com']; 
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'gmail-nodejs-quickstart.json';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Gmail API.
  // authorize(JSON.parse(content), listLabels);
  authorize(JSON.parse(content), listMessages);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  // var auth = new googleAuth();
  var oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLabels(auth) {
  var gmail = google.gmail('v1');
  gmail.users.labels.list({
    auth: auth,
    userId: 'me',
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var labels = response.labels;
    if (labels.length == 0) {
      console.log('No labels found.');
    } else {
      console.log('Labels:');
      for (var i = 0; i < labels.length; i++) {
        var label = labels[i];
        console.log('- %s', label.name);
      }
    }
  });
}


function listMessages(auth) {
  var gmail = google.gmail('v1');
  gmail.users.messages.list({
    auth: auth,
    userId: 'me',
    labelIds: ['Label_1']
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    // console.log(response);
    messages = response.data.messages;
    // console.log(messages);
    if (messages == undefined || (messages != undefined && messages.length == 0)) {
      console.log('No messages found.');
    } else {
      console.log(messages.length +' New Messages found');

      // Create connection to AMQP server
      amqplib.connect(config.amqp, (err, connection) => {
          if (err) {
              console.error(err.stack);
              return process.exit(1);
          }

          // Create channel
          connection.createChannel((err, channel) => {
              if (err) {
                  console.error(err.stack);
                  return process.exit(1);
              }

              // Ensure queue for messages
              channel.assertQueue(config.queue, {
                  // Ensure that the queue is not deleted when server restarts
                  durable: true
              }, err => {
                  if (err) {
                      console.error(err.stack);
                      return process.exit(1);
                  }

                  // Create a function to send objects to the queue
                  // Javascript opbject is converted to JSON and the into a Buffer

                  let messageCount = 0;
                  let totalMessage = messages.length;

                  let sendToAMQP = function(content){
                      messageCount = messageCount + 1;
                      console.log("Message is getting pushed to queue: "+messageCount+"/"+totalMessage);
                      let sent = channel.sendToQueue(config.queue, Buffer.from(JSON.stringify(content)), {
                          // Store queued elements on disk
                          persistent: true,
                          contentType: 'application/json'
                      });
                      if (totalMessage <= messageCount) {
                        console.log("All messages Queued");
                        console.log("closing connection");
                        channel.close(() => connection.close());
                      }
                  };

                  if(messages != undefined){
                    for (var i = 0; i < messages.length; i++) {
                      var message = messages[i];
                      // console.log('- %s', label.name);
                      var messageRequest = gmail.users.messages.get({
                        auth: auth,
                        'userId': 'me',
                        'id': message.id
                      }, function(err, message){
                        var sender = getHeader(message.data.payload.headers,"To");
                        var fromAddr = getHeader(message.data.payload.headers,"From");
                        var subject = getHeader(message.data.payload.headers,"Subject");
                        console.log(validateEmailAddress(sender));
                        let emailArr = validateEmailAddress(sender);
                        if(emailArr.length > 0){
                          client.get("http://localhost:8000/api/posts/"+emailArr[0], function (data, response) {
                              // parsed response body as js object
                              console.log(data);
                              // console.log(message.data.payload.headers);
                              var labels = [];
                              if(data && data['_id']){
                                labels = ["Label_3"];
                                var msg = {};
                                console.log(emailArr);
                                if(emailArr[1] == 'poster@healthyfling.com'){
                                  msg = {
                                      to: data.email,
                                      replyTo: data['_id']+"-"+cryptr.encrypt(fromAddr)+"-reply@healthyfling.com",
                                      subject: subject,
                                      html: getBody(message.data.payload)
                                  };
                                }else if(emailArr[2] == 'reply@healthyfling.com'){
                                  msg = {
                                      to: cryptr.decrypt(emailArr[1]),
                                      replyTo: data['_id']+"-poster@healthyfling.com",
                                      subject: subject,
                                      html: getBody(message.data.payload)
                                  };
                                }
                                sendToAMQP(msg);
                              }else{
                                labels = ["Label_2"]
                              }
                              var messageRequest = gmail.users.messages.modify({
                                auth: auth,
                                'userId': 'me',
                                'id': message.data.id,
                                'resource':{
                                  'addLabelIds': labels,
                                  'removeLabelIds': ['Label_1']
                                }
                              }, function(err){
                                if (err) {
                                  console.log(error.Error);
                                }else{
                                  console.log("Moved message with ID:"+message.data.id+" to "+ labels.toString());
                                }
                              });
                              // console.log(getBody(message.payload));
                          });
                        }
                        // console.log(getBody(message.payload));
                      });
                    }
                  }


              });
          });
      });

    }
  });
}


function getHeader(headers, index) {
  var header = '';
  for (var i = 0; i < headers.length; i++) {
    if(headers[i].name === index){
      header = headers[i].value;
    }
  }
  return header;
}

function validateEmailAddress(email){
  var arr = email.split("-");
  if (arr.length > 1)
    return arr;
  return [];
}

function getBody(message) {
  var encodedBody = '';
  if(typeof message.parts === 'undefined')
  {
    encodedBody = message.body.data;
  }
  else
  {
    encodedBody = getHTMLPart(message.parts);
  }
  encodedBody = encodedBody.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  return decodeURIComponent(escape(atob(encodedBody)));
}

function getHTMLPart(arr) {
  for(var x = 0; x <= arr.length; x++)
  {
    if(typeof arr[x].parts === 'undefined')
    {
      if(arr[x].mimeType === 'text/html')
      {
        return arr[x].body.data;
      }
    }
    else
    {
      return getHTMLPart(arr[x].parts);
    }
  }
  return '';
}
