'use strict';

const {EventEmitter} = require('events');
const debug = require('debug')('lnquake:ioq3');

const fork = require('child_process').fork;
const path = require('path');

class IOQ3Manager extends EventEmitter {
    constructor(fs_cdn='localhost:9000') {
        super();

        const program = path.join(__dirname, '../build/ioq3ded.js');
        const parameters = `+set fs_game baseq3 +set dedicated 1 +set fs_cdn ${fs_cdn} +exec server.cfg`.split(' ');
        const options = {
            stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ],
            cwd: path.join(__dirname, '../')
        };

        const _self = this;

        this.process = fork(program, parameters, options);

        const logDebug = require('debug')('lnquake:ioq3ded');

        this.process.on('message', m => _self.processMessage(m));
        this.process.stderr.on('data', d => logDebug(d.toString()));
    }

    processMessage(message) {
        const _self = this;

        debug('Incoming message', message);

        this.emit('message', message);

        switch (message.action) {
            case 'RESULT':
                this.emit('result', message.data);
                break;
        }
    }

    authorize(id) {
        this.send({
            action: 'AUTHORIZE',
            data: {
                id: id
            }
        });
    }

    send(message) {
        debug('Sending', message);

        this.process.send(message);
    }
}

module.exports = IOQ3Manager;
