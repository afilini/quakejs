'use strict';

const {EventEmitter} = require('events');
const debug = require('debug')('lnquake:engine');
const assert = require('assert');

const INVOICE_AMOUNT = 1000;

//const WAITING_TIMEOUT = 5 * 60 * 1000;
const WAITING_TIMEOUT = 5 * 1000;
const HANDSHAKE_TIMEOUT = 2 * 60 * 1000;
const HANDSHAKE_RESET_TIMEOUT = 15 * 1000;

function _makeState(stateName, data) {
    return {
        state: stateName,
        data
    };
}

function makeWaitingFirstState(numPlayers) {
    return _makeState('WAITING_FIRST_PLAYERS', { numPlayers });
}

function makeWaitingState(startTime, timeout, numPlayers) {
    return _makeState('WAITING', { startTime, timeout, numPlayers });
}

function makeHandshakeState(startTime, timeout, numPlayers) {
    return _makeState('HANDSHAKE', { startTime, timeout, numPlayers });
}

function makePlayingState(numPlayers) {
    return _makeState('PLAYING', { numPlayers });
}

function makeDoneState(result) {
    return _makeState('DONE', { result });
}

class LNQuakeEngine extends EventEmitter {
    constructor(ioq3) {
        super();

        const _self = this;

        this.ioq3 = ioq3;

        this.state = makeWaitingFirstState(0);
        this.players = {};

        // track the invoices during the handshake
        this.invoices = {};
        this.invoicesIndex = {};

        this.transitionTimeout = null;
    }

    canAcceptPlayer() {
        // TODO: also check the number
        return this.state.state == 'WAITING' || this.state.state == 'WAITING_FIRST_PLAYERS';
    }

    numPlayers() {
        return Object.keys(this.players).length;
    }

    getPlayers() {
        return Object.keys(this.players);
    }

    playerConnected(id, object) {
        debug('Connected player', id, object)
        if (!this.canAcceptPlayer()) {
            debug('We cannot accept it');
            return false;
        }

        this.players[id] = object;
        this.invoices[id] = {};
        this.emit('NEW_PLAYER', {id, username: object.username, number: this.numPlayers()});

        this.state.data.numPlayers++;
        debug('New player count: ' + this.state.data.numPlayers);

        // Start the timeout for all the others
        if (this.state.state == 'WAITING_FIRST_PLAYERS' && this.numPlayers() >= 2) {
            this.goToWaiting();
        }

        return true;
    }

    playerDisconnected(id) {
        debug('Player', id, 'disconnected');
        if (!this.players[id]) {
            return false;
        }

        delete this.players[id];
        delete this.invoices[id];
        this.emit('LOST_PLAYER', {id, number: this.numPlayers()});

        this.state.data.numPlayers--;
        debug('New player count: ' + this.state.data.numPlayers);

        // this was our only player
        if (this.state.state == 'WAITING_FIRST_PLAYERS') {
            return;
        }

        // make sure that we have at least 2 players left
        if (this.state.state == 'WAITING') {
            if (this.numPlayers() >= 2) {
                return;
            }

            // we have to revert back to WAITING_FIRST_PLAYERS
            this.revertWaiting();
            return;
        }

        // cancel the handshake :(
        if (this.state.state == 'HANDSHAKE') {
            if (this.numPlayers() >= 2) {
                this.revertHandshake(); // and go back to WAITING
            } else {
                this.revertWaiting(); // and go back to WAITING_FIRST_PLAYERS
            }
        }
    }

    goToWaiting() {
        debug('goToWaiting');
//        assert(this.state.state == 'WAITING_FIRST_PLAYERS');
        
        const _self = this;

        this.emit('START_WAITING');

        this.state = makeWaitingState(new Date(), WAITING_TIMEOUT, this.numPlayers());
        this.emit('STATE_NOTIFICATION');

        this.transitionTimeout = setTimeout(() => _self.goToHandshake(), WAITING_TIMEOUT);
    }

    revertWaiting() {
        debug('revertWaiting');
//        assert(this.state.state == 'WAITING');

        this.emit('RESET_HANDSHAKE');
        this.emit('RESET_WAITING');

        this.state = makeWaitingFirstState(this.numPlayers());
        this.emit('STATE_NOTIFICATION');

        clearTimeout(this.transitionTimeout);
    }

    goToHandshake() {
        debug('goToHandshake');
        assert(this.state.state == 'WAITING'); 

        const _self = this;

        this.emit('START_HANDSHAKE');

        for (const player in this.players) {
            this.invoices[player] = {};
        }
        this.invoicesIndex = {};
        this.requiredPayments = this.numPlayers() * (this.numPlayers() - 1);
        this.receivedPayments = 0;

        this.state = makeHandshakeState(new Date(), HANDSHAKE_TIMEOUT, this.numPlayers());
        this.emit('STATE_NOTIFICATION');

        this.transitionTimeout = setTimeout(() => _self.revertHandshake(), HANDSHAKE_TIMEOUT);
    }

    revertHandshake() {
        debug('revertHandshake');

        const _self = this;

        // this will also cause all the pending payments to fail
        this.emit('RESET_HANDSHAKE');

        this.state = makeWaitingState(new Date(), HANDSHAKE_RESET_TIMEOUT, this.numPlayers());
        this.emit('STATE_NOTIFICATION');

        clearTimeout(this.transitionTimeout);
        this.transitionTimeout = setTimeout(() => _self.goToHandshake(), HANDSHAKE_RESET_TIMEOUT);
    }

    goToPlaying() {
        debug('goToPlaying');
        assert(this.state.state == 'HANDSHAKE');
        assert(this.requiredPayments == this.receivedPayments);
        
        this.emit('START_PLAYING');
        
        const _self = this;

        for (const player in this.players) {
            this.ioq3.authorize(player); // allow them to join
        }
        this.ioq3.once('result', (result) => _self.registerResult(result));

        this.state = makePlayingState(this.numPlayers());
        this.emit('STATE_NOTIFICATION');

        // clear the failed handshake timeout
        clearTimeout(this.transitionTimeout);
    }

    goToDone(result) {
        debug('goToDone', result);
        this.emit('START_DONE')
        this.emit('RESULT', result);

        this.state = makeDoneState(result);
        this.emit('STATE_NOTIFICATION');
    }

    registerInvoice(from, paymentHash) {
        if (!this.state.state == 'HANDSHAKE') {
            return;
        }

        // who gets that one?
        for (const player in this.players) {
            if (player != from && !this.invoices[from][player]) {
                debug(`Assigned invoice ${paymentHash} from ${from} to ${player}`);
                this.invoices[from][player] = paymentHash;
                this.invoicesIndex[paymentHash] = {from, to: player};

                return player;
            }
        }

        return null;
    }

    registerPayment(paymentHash) {
        debug('registerPayment', paymentHash);

        if (this.state.state != 'HANDSHAKE') {
            debug('Cannot accept payment, we are in state', this.state.state);
            return Promise.reject();
        }

        // never heard of this one
        if (!this.invoicesIndex[paymentHash]) {
            debug('Cannot accept payment, unknown paymentHash');
            return Promise.reject();
        }

        debug('Keeping the payment on hold...');

        // TODO: validate the amount somhow?

        this.receivedPayments++;
        if (this.requiredPayments == this.receivedPayments) {
            // we made it!
            this.goToPlaying();
        }

        const _self = this;

        return new Promise((resolve, reject) => {
            _self.once('RESET_HANDSHAKE', reject);

            _self.once('result-' + paymentHash, (result) => {
                debug('Result for payment ' + paymentHash + ': ' + result);

                if (result) resolve();
                else        reject();
            });
        });
    }

    registerResult(result) {
        debug('registerResult', result);

        if (!this.state.state == 'PLAYING') {
            return;
        }

        // TODO!!
    }

    getState() {
        return this.state;
    }
}

module.exports = LNQuakeEngine;
