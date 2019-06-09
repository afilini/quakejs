#!/usr/bin/env node

const debug = require('debug')('lnquake:index');
const LightningClient = require('lightning-client');

const JSONRpcServer = require('./jsonrpc');
const LNQuakeEngine = require('./engine');
const IOQ3Manager = require('./ioq3-manager');
const webserver = require('./webserver');

const server = new JSONRpcServer();
//const ioq3 = new IOQ3Manager('localhost:9000');
const ioq3 = new IOQ3Manager('content.quakejs.com');

const engine = new LNQuakeEngine(ioq3);

server.on('getmanifest', msg => {
	msg.reply({
		options: [],
		rpcmethods: [{
                    name: 'debug_accept_all',
                    usage: '',
                    description: 'Accept all the pending payments, useful to cancel a game'
                }],
		subscriptions: [],
		hooks: ["htlc_accepted"]
	});
}); 

server.on('debug_accept_all', () => engine.debugAcceptAll());

server.on('htlc_accepted', msg => {
//        debug(msg);
        
        engine.registerPayment(msg.htlc.payment_hash)
            .then(() => msg.reply({result: 'continue'}))
            .catch((e) => {
                debug(e);

                msg.reply({result: 'fail'});
            });
});

server.on('init', (msg) => {
    const client = new LightningClient(msg.configuration['lightning-dir']);
    webserver(client, engine);
});
