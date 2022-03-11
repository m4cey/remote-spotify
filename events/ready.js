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
			'options': {
				'followup': true,
				'sync_context': true,
				'threshold': 6,
				'updaterate': 5000,
				'progressrate': 1000,
				'margin': 10000,
			}
		}).save();
		db.get('listening').set([]).save();
	},
};
