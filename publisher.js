'use strict';

// var CryptoJS = require("crypto-js");

// var ciphertext = CryptoJS.AES.encrypt('duttasubh2010@gmail.com', 'secret key 123');
// console.log(CryptoJS.HmacSHA1("duttasubh2010@gmail.com", "secret key 123").toString());
// console.log(ciphertext.toString());

var Cryptr = require('cryptr'),
    cryptr = new Cryptr('Ji5RW2BlJ6');

var encryptedString = cryptr.encrypt('duttasubh2010@gmail.com'),
decryptedString = cryptr.decrypt(encryptedString);

console.log(encryptedString);  // e74d7c0de21e72aaffc8f2eef2bdb7c1
console.log(decryptedString);  // bacon

// const amqplib = require('amqplib/callback_api');
// const config = require('./config');

// // Create connection to AMQP server
// amqplib.connect(config.amqp, (err, connection) => {
//     if (err) {
//         console.error(err.stack);
//         return process.exit(1);
//     }

//     // Create channel
//     connection.createChannel((err, channel) => {
//         if (err) {
//             console.error(err.stack);
//             return process.exit(1);
//         }

//         // Ensure queue for messages
//         channel.assertQueue(config.queue, {
//             // Ensure that the queue is not deleted when server restarts
//             durable: true
//         }, err => {
//             if (err) {
//                 console.error(err.stack);
//                 return process.exit(1);
//             }

//             // Create a function to send objects to the queue
//             // Javascript opbject is converted to JSON and the into a Buffer
//             let sender = (content, next) => {
//                 let sent = channel.sendToQueue(config.queue, Buffer.from(JSON.stringify(content)), {
//                     // Store queued elements on disk
//                     persistent: true,
//                     contentType: 'application/json'
//                 });
//                 if (sent) {
//                     return next();
//                 } else {
//                     channel.once('drain', () => next());
//                 }
//             };

//             // push 100 messages to queue
//             let sent = 0;
//             let sendNext = () => {
//                 if (sent >= 100) {
//                     console.log('All messages sent!');
//                     // Close connection to AMQP server
//                     // We need to call channel.close first, otherwise pending
//                     // messages are not written to the queue
//                     return channel.close(() => connection.close());
//                 }
//                 sent++;
//                 sender({
//                     to: 'recipient@example.com',
//                     subject: 'Test message #' + sent,
//                     text: 'hello world!'
//                 }, sendNext);
//             };

//             sendNext();

//         });
//     });
// });
