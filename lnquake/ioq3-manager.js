'use strict';

const {EventEmitter} = require('events');

const debug = require('debug')('lnquake:ioq3');
const logDebug = require('debug')('lnquake:ioq3ded');

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

        this.logBuffer = '';
        this.readingScores = false;
        this.scores = [];

        this.scoreRegex = /.*client: +\d+ +(.*)/;

        this.process = fork(program, parameters, options);

        this.process.on('message', m => _self.processMessage(m));
        this.process.stderr.on('data', d => _self.processLog(d.toString()));
    }

    processLine(line) {
        logDebug(line);

        if (!this.readingScores && line.startsWith('score')) {
            this.readingScores = true;
            this.scores = [];
        } 

        if (this.readingScores) {
            if (line.startsWith('broadcast')) {
                this.readingScores = false;
                this.emit('result', this.scores);
            } else if (line.startsWith('score')) {
                const match = line.match(this.scoreRegex);
                this.scores.push(match[1]);
            }
        }
    }

    processLog(chunk) {
        this.logBuffer += chunk;

        const canPrune = this.logBuffer.lastIndexOf('\n');
        if (canPrune == -1) {
            return;
        }

        const prunable = this.logBuffer.substr(0, canPrune);
        this.logBuffer = this.logBuffer.substr(canPrune);

        const lines = prunable.split('\n');
        for (let i = 0; i < lines.length; i++) {
            this.processLine(lines[i]);
        }
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
