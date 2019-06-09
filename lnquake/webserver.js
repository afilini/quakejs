'use strict';

const path = require('path');
const uuidv4 = require('uuid/v4');
const express = require('express');
const debug = require('debug')('lnquake:webserver');

const websocket = require('./websocket');

const PORT = 3000;

const app = express();

require('express-ws')(app);

module.exports = (rpc, engine) => {
        app.ws('/', websocket(rpc, engine));

	app.get('/node', (req, res) => {
		rpc.getinfo().then(info => res.render('index', {title: 'Node Info', pre: JSON.stringify(info, null, 4)}));
	});

	app.listen(PORT, () => debug(`Auctions server listening on port ${PORT}!`))
};
