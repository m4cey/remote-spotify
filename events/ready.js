const StormDB = require('stormdb');
const { Engine } = require('../database.js');

module.exports = {
	name: 'ready',
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		const db = new StormDB(Engine);
		db.default({
			'listening': [],
			'authenticated': {},
			'options': { 'followup': true, 'messageLimit': 6 }
		}).save();
		db.get('listening').set([]).save();
	},
};
