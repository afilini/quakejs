'use strict';

const authorized = {};

console.error('loaded-by-quake.js started');

process.on('message', message => {
    console.error('Got message', message);

    switch (message.action) {
        case 'AUTHORIZE':
            const id = message.data.id;
            console.error('authorizing', id);

            authorized[id] = true;
            break;
    }
});

module.exports = {
    tryLogin: function (client) {
        console.error(`Login check for '${client}'`, client);
        console.error(authorized);

        if (!authorized[client]) {
            return 0;
        }

        console.error('CHECK OK');
        // You can log-in only once
        //authorized[client] = false;

        return 1;
    },
    finalResult: function (res) {
        process.send({action: 'RESULT', data: res});
    }
}
