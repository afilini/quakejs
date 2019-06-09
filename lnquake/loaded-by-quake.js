'use strict';

const authorized = {};

console.error('loaded-by-quake.js started');

process.on('message', message => {
    console.error('Got message', message);

    switch (message.action) {
        case 'AUTHORIZE':
            const id = message.data.id;
            const short_id = id.substr(0, 32);

            console.error('truncating', id, 'to', short_id);
            console.error('authorizing', short_id);

            authorized[short_id] = true;
            break;
    }
});

module.exports = {
    tryLogin: function (client) {
        console.error(`Login check for '${client}'`, authorized[client]);
        console.error(authorized);

        if (!authorized[client]) {
            return 0;
        }

        console.error('CHECK OK');
        // You can log-in only once
        authorized[client] = false;

        return 1;
    },
    finalResult: function (res) {
        process.send({action: 'RESULT', data: res});
    }
}
