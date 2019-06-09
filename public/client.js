
// timer functions

Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
}

let timer = {
    interval: null,
    to: new Date(),
    doneCallback: null
};

function countdownInterval() {
    if (timer.to < (new Date())) {
        timerText.innerText = '00:00:00';

        clearInterval(timer.interval);

        if (timer.doneCallback) {
            timer.doneCallback();
        }

        return;
    }

    const left = timer.to - (new Date());
    const fmt = '' + Math.floor(left / 60000).pad(2) + ':' + Math.floor((left % 60000) / 1000).pad(2) + ':' + (left % 1000).pad(3);
    timerText.innerText = fmt;
}

function startCountdown(to, callback) {
    clearInterval(timer.interval);

    timer.to = new Date(to);
    timer.interval = setInterval(countdownInterval, 100);
    timer.doneCallback = callback;
}

// socket functions

function startClient(ioq3Callback) {
    const us = {
        username: '',
        password: ''
    };

    // ----- BEGIN --------

    let ws = new WSConnection(onConnected, onMessage);

    function WSConnection(connectedCallback, messageCallback) {
        const ws = new WebSocket("ws://localhost:3000");

        let callbackRun = false;

        ws.onopen = () => {
            if (!callbackRun) {
                connectedCallback();
            }
        };

        ws.onmessage = (message) => {
            let m = {};

            try {
                m = JSON.parse(message.data);
            } catch (e){
                console.warn(e);
            }

            messageCallback(m);
        };

        ws.onclose = function(e) {};

        ws.onerror = function(err) {
            console.error('Socket encountered error: ', err.message, 'Closing socket');
            ws.close();
        };

        this.send = function (action, data) {
            ws.send(JSON.stringify({ action, data }));
        }
    }

    function doHandshake(numPlayers) {
        WebLN
            .requestProvider()
            .then(async function (provider) {
                for (let i = 0; i < numPlayers - 1; i++) {
                    const invoice = await provider.makeInvoice({amount: 1, defaultMemo: 'Test'});
                    console.log('Invoice generated...');

                    ws.send('INVOICE', { invoice: invoice.paymentRequest} );
                }
            });
    }

    function onMessage(data) {
        console.debug(data);

        switch (data.action) {
            case 'INVOICE':
                console.log('Paying invoice', data.data.invoice);
                // TODO: do some checks here...

                WebLN
                    .requestProvider()
                    .then(provider => provider.sendPayment(data.data.invoice));
                break;

            case 'ID':
                console.log('Our ID is', data.data.id);
                us.password = data.data.id;

               // ioq3Callback(us.username, us.password);
                break;
            case 'STATE_NOTIFICATION':
                console.log('State notification', data.data.state);

                if (data.data.state == 'HANDSHAKE') {
                    doHandshake(data.data.data.numPlayers);
                } else if (data.data.state == 'PLAYING') {
                    ioq3Callback(us.username, us.password);
                }

                break;
            case 'NEW_PLAYER':
                console.log('New player', data.data);
                break;
            case 'LOST_PLAYER':
                console.log('Lost player', data.data);
                break;

        }
    }

    function onConnected() {
        var frame = document.getElementById('username-frame');

        frame.style.display = 'inherit';

        document.getElementById('username-continue').onclick = function () {
            var val = document.getElementById('username').value;
            console.log(val);
            frame.style.display = 'none';

            us.username = val;

            ws.send('USERNAME', {username: val});
        }
    }
}
