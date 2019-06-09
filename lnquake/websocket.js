'use strict';

const debug = require('debug')('lnquake:websocket');
const uuidv4 = require('uuid/v4');

module.exports = function (rpc, engine) {
    const clients = {};

    return function websocket (ws, req) {
        const id = uuidv4();
        clients[id] = ws;

        function send(action, data) {
            try {
                ws.send(JSON.stringify({
                    action, data
                }));
            } catch (e) {
                ws.close();
            }
        }
        ws.sendWithAction = send;

        // TODO: remove listeners!!

        // Send the current state
        send('STATE_NOTIFICATION', engine.getState());

        function onStateNotification() {
            send('STATE_NOTIFICATION', engine.getState());
        }
        engine.on('STATE_NOTIFICATION', onStateNotification);

        function onConnectedPlayer(data) {
            send('NEW_PLAYER', data);
        }
        engine.on('NEW_PLAYER', onConnectedPlayer);

        function onLostPlayer(data) {
            send('LOST_PLAYER', data);
        }
        engine.on('LOST_PLAYER', onLostPlayer);

        ws.on('close', function () {
            engine.playerDisconnected(id);

            engine.removeListener('STATE_NOTIFICATION', onStateNotification);
            engine.removeListener('NEW_PLAYER', onConnectedPlayer);
            engine.removeListener('LOST_PLAYER', onLostPlayer);

            delete clients[id];
        });

        ws.on('message', function(msg) {
            try {
                msg = JSON.parse(msg);
            } catch(e) {
                return;
            }

            switch (msg.action) {
                case 'INVOICE':
                    debug('Received invoice message', msg.data);

                    const invoice = msg.data.invoice;
                    rpc.decodepay(invoice)
                        .then(res => {
                            const invoiceFor = engine.registerInvoice(id, res.payment_hash);
                            if (invoiceFor != null && clients[invoiceFor]) {
                                clients[invoiceFor].sendWithAction('INVOICE', { invoice });
                            }
                        })
                        .catch((e) => debug('Could not register invoice from', id, e)); // TODO!!
                break;
                case 'USERNAME':
                    let result = engine.playerConnected(id, msg.data);
                    
                    if (!result) {
                        // TODO: send something
                        ws.close();
                    }

                    send('ID', {id: id});

                    break;
            }

            debug(msg);
        });

        ws.on('error', () => ws.close());
    }
};
