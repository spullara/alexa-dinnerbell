/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/
'use strict';

const Alexa = require('alexa-sdk');
const AWS = require('aws-sdk');
const url = require('url');
const https = require('https');

// The base-64 encoded, encrypted key (CiphertextBlob) stored in the kmsEncryptedHookUrl environment variable
const kmsEncryptedHookUrl = process.env.kmsEncryptedHookUrl;
let hookUrl;

const APP_ID = undefined; // TODO replace with your app ID (OPTIONAL).

const handlers = {
    'DinnerBell': function () {
        console.log("ringing bell");
        if (hookUrl) {
            processEvent(this);
        } else if (kmsEncryptedHookUrl && kmsEncryptedHookUrl !== '<kmsEncryptedHookUrl>') {
            const encryptedBuf = new Buffer(kmsEncryptedHookUrl, 'base64');
            const cipherText = { CiphertextBlob: encryptedBuf };

            const kms = new AWS.KMS();
            kms.decrypt(cipherText, (err, data) => {
		    if (err) {
			this.emit("Failed to ring the bell.");
			console.error(err);
			return;
		    }
		    hookUrl = `https://${data.Plaintext.toString('ascii')}`;
		    processEvent(this);
		});
        } else {
            this.emit(":tell", "No slack hook is configured.");
        }
    }
};

function processEvent(emitter) {
    const slackMessage = {
        text: `@here the dinner bell is being rung!`,
    };

    console.log("Posting slack message");
    postMessage(slackMessage, (response) => {
	    if (response.statusCode < 400) {
		emitter.emit(':tell', "Rung the bell.");
	    } else if (response.statusCode < 500) {
		emitter.emit(':tell', "The bell may be broken, Slack failed to post the message.");
	    }
	});
}

function postMessage(message, callback) {
    const body = JSON.stringify(message);
    const options = url.parse(hookUrl);
    options.method = 'POST';
    options.headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
    };

    const postReq = https.request(options, (res) => {
	    console.log("configured response");
	    const chunks = [];
	    res.setEncoding('utf8');
	    res.on('data', (chunk) => chunks.push(chunk));
	    res.on('end', () => {
		    if (callback) {
			callback({
				body: chunks.join(''),
				statusCode: res.statusCode,
				statusMessage: res.statusMessage,
			    });
		    }
		});
	    return res;
	});
    postReq.write(body);
    postReq.end();
}

exports.handler = (event, context) => {
    const alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.registerHandlers(handlers);
    alexa.execute();
};
