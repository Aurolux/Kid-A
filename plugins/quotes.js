'use strict';

const fs = require('fs');

const server = require('../server.js');
const databases = require('../databases.js');

let quotedata;

function loadQuotes() {
	let data;
	try {
		data = require('../data/quotes.json');
	} catch (e) {}

	if (typeof data !== 'object' || Array.isArray(data)) data = {};

	return data;
}

function writeQuotes() {
	let toWrite = JSON.stringify(quotedata);
	fs.writeFileSync('./data/quotes.json', toWrite);
}

databases.addDatabase('quotes', loadQuotes, writeQuotes);
quotedata = databases.getDatabase('quotes');

server.addTemplate('quotes', 'quotes.html');

function quoteResolver(req, res) {
	let room = req.originalUrl.split('/')[1];
	if (Config.privateRooms.has(room)) {
		let query = server.parseURL(req.url);
		let token = query.token;
		if (!token) return res.end('Private room quotes require an access token to be viewed.');
		let data = server.getAccessToken(token);
		if (!data) return res.end('Invalid access token.');
		if (data[room]) {
			res.end(server.renderTemplate('quotes', {room: room, data: quotedata[room]}));
		} else {
			res.end('Permission denied.');
		}
	} else {
		res.end(server.renderTemplate('quotes', {room: room, data: quotedata[room]}));
	}
}

for (let room in quotedata) {
	server.addRoute('/' + room + '/quotes', quoteResolver);
}

module.exports = {
	commands: {
		quote: {
			permission: 2,
			disallowPM: true,
			action(message) {
				if (!message.length) return this.pmreply("Please enter a valid quote.");

				if (!quotedata[this.room]) {
					quotedata[this.room] = [];
					if (!Config.privateRooms.has(this.room)) {
						server.addRoute('/' + this.room + '/quotes', quoteResolver);
						// Wait 500ms to make sure everything's ready.
						setTimeout(() => server.restart(), 500);
					}
				}

				if (quotedata[this.room].includes(message)) {
					return this.reply("Quote is already added.");
				}

				quotedata[this.room].push(message);
				databases.writeDatabase('quotes');
				return this.reply("Quote has been added.");
			},
		},

		deletequote: {
			permission: 2,
			disallowPM: true,
			action(message) {
				message = toId(message);

				if (!message.length) return this.pmreply("Please enter a valid quote.");
				if (!quotedata[this.room]) return this.pmreply("This room has no quotes.");

				for (let i = 0; i < quotedata[this.room].length; i++) {
					if (toId(quotedata[this.room][i]) === message) {
						this.reply("Removed quote: " + quotedata[this.room].splice(i, 1)[0]);
						return databases.writeDatabase('quotes');
					}
				}

				return this.reply("Quote not found.");
			},
		},

		quotes: {
			permission: 1,
			disallowPM: true,
			action() {
				if (quotedata[this.room]) {
					let fname = this.room + "/quotes";
					if (Config.privateRooms.has(this.room)) {
						let data = {};
						data[this.room] = true;
						let token = server.createAccessToken(data, 15);
						fname += '?token=' + token;
					}
					return this.reply("Quote page: " + server.url + fname);
				}

				return this.pmreply("This room has no quotes.");
			},
		},

		randquote: {
			permission: 1,
			disallowPM: true,
			action() {
				if (quotedata[this.room]) {
					return this.reply(quotedata[this.room][Math.floor(Math.random() * quotedata[this.room].length)]);
				}

				return this.pmreply("This room has no quotes.");
			},
		},
	},
};