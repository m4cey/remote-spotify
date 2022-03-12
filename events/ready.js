require('dotenv').config();
const fs = require('node:fs');
const StormDB = require('stormdb');
const { Engine } = require('../database.js');
const createConnection = require('../sftp.js');

let sftp;

async function retrieveDB () {
	sftp = await createConnection();
	console.log('Retrieving stormdb file');
	try {
		await sftp.fastGet('/storage/db.stormdb', '../db.stormdb');
	} catch (error) {
		console.log('Couldn\'t retrieve db', error);
	}
}

async function updateDB () {
	await fs.watch('db.stormdb', async () => {
		console.log("db changed, uploading...");
		await sftp.fastPut('../db.stormdb', '/storage/db.stormdb');
		console.log("finished uploading...");
	});
}

module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {
		await retrieveDB();
		updateDB();
		console.log(`Ready! Logged in as ${client.user.tag}`);
		const db = new StormDB(Engine);
		db.default({
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
	},
};
