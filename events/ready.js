require('dotenv').config();
const logger = require('../logger.js');
const fs = require('node:fs');
const cmd = require('node-cmd');
const StormDB = require('stormdb');
const { Engine } = require('../database.js');
const createConnection = require('../sftp.js');

async function retrieveDB () {
	sftp = await createConnection();
	logger.debug('Retrieving stormdb file');
	try {
		await sftp.fastGet('/storage/db.stormdb', '/tmp/db.stormdb');
	} catch (error) {
		logger.error(error, 'Couldn\'t retrieve db');
	}
}

async function updateDB () {
	await fs.watch('/tmp/db.stormdb', async () => {
		logger.debug("db changed, uploading...");
		await sftp.fastPut('/tmp/db.stormdb', '/storage/db.stormdb');
		logger.debug("finished uploading...");
	});
}

async function pingSelf() {
	if (process.env.ENV == 'glitch')
		cmd.runSync(`curl ${process.env.DOMAIN}`);
}

module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {
		logger.debug(process.env.LOCAL);
		if (process.env.LOCAL != 1) {
			await retrieveDB();
			updateDB();
		}
		setInterval(pingSelf, 3000);
		logger.info(`Ready! Logged in as ${client.user.tag}`);
		const db = new StormDB(Engine);
		db.default({
			'authenticated': {},
			'options': {
				'followup': true,
				'sync_context': false,
				'threshold': 6,
				'updaterate': 5000,
				'refreshrate': 5000,
				'margin': 10000,
			}
		}).save();
	},
};
