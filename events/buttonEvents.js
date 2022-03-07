const wait = require('node:timers/promises').setTimeout;
const StormDB = require("stormdb");
const methods = require('../methods.js');
const { Engine } = require('../database.js');
const db = new StormDB(Engine);

let buttons = {};

buttons.joinButton = async (interaction) => {
	const db = new StormDB(Engine);
	if (methods.isListener(interaction.user.id)) {
		const message = { content: "`you're already in the party`", ephemeral: true };
		interaction.followUp(message);
		return;
	}
	const authenticated = db.get('authenticated').value();
	const authIds = Object.keys(authenticated);
	console.log(authIds);
	if (authIds.includes(interaction.user.id))
		methods.addListener(interaction);
	else
		methods.postGuide(interaction);
}

buttons.leaveButton = (interaction) => {
	methods.removeListener(interaction);
}

buttons.playButton = async (interaction) => {
	const db = new StormDB(Engine);
	if (!methods.isListener(interaction.user.id)) return;
	const leaderId = db.get('listening').value()[0];
	let leaderToken;
	await methods.batchExecute(async (spotifyApi, token, userId) => {
		if (userId == leaderId)
			leaderToken = token;
		try {
			await spotifyApi.setAccessToken(leaderToken);
			const data = await spotifyApi.getMyCurrentPlaybackState();
			await spotifyApi.setAccessToken(token);
			if (data.body && data.body.is_playing)
				await spotifyApi.pause();
			else
				await spotifyApi.play();
			} catch (error) {
				console.log(error);
			}
		});
}

buttons.previousButton = async (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	await methods.batchExecute(async (spotifyApi, token, userId) => {
		try {
			await spotifyApi.skipToPrevious();
		} catch (error) {
			console.log(error);
		}
	});
}

buttons.nextButton = async (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	await methods.batchExecute(async (spotifyApi, token, userId) => {
		try {
			await spotifyApi.skipToNext();
		} catch (error) {
			console.log(error);
		}
	});
}

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		if (!interaction.isButton())	return;
		console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered a button: ${interaction.customId}`);
		try {
			console.log(`interaction ${interaction.id} beggining deferral`);
			await interaction.deferUpdate();
			console.log(`interaction ${interaction.id} has been deferred`);
			await buttons[interaction.customId + 'Button'](interaction);
			await methods.updateRemote(interaction);
			await methods.updateRemote(interaction);
		} catch (error) {
			console.log(error);
		}
	},
};
