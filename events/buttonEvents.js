const wait = require('node:timers/promises').setTimeout;
const SpotifyWebApi = require('spotify-web-api-node');
const StormDB = require("stormdb");
const methods = require('../methods.js');
const { Engine } = require('../database.js');
const db = new StormDB(Engine);

let buttons = {};

buttons.joinButton = async (interaction) => {
	const db = new StormDB(Engine);
	if (methods.isListener(interaction.user.id)) {
		const message = { embeds: [{title: "you're already in the party",
			description: "wake up!" }], ephemeral: true };
		interaction.followUp(message);
		return;
	}
	const userIds = Object.keys(db.get('authenticated').value());
	const userId = interaction.user.id;
	if (userIds.includes(userId)) {
		console.log('USERID: ', userId);
		try {
			const token = await methods.getToken(userId);
			const spotifyApi = new SpotifyWebApi();
			await spotifyApi.setAccessToken(token);
			const data = await spotifyApi.getMyCurrentPlaybackState();
			methods.validateResponse(data, true);
			methods.addListener(interaction);
		} catch (error) {
			console.log('in JoinButton():', error);
			if (error.status == 204) {
				const message = { embeds: [{ title: "Device is inactive",
					description: "Make sure your spotify app is open and play a track to make it active!" }], ephemeral: true };
				interaction.followUp(message);
			}
		}
	}
	else
		methods.postGuide(interaction);
}

buttons.leaveButton = (interaction) => {
	methods.removeListener(interaction.user.id);
}

buttons.playButton = async (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	const listening = methods.getListening();
	const { is_playing } = methods.getPlayingTrack();
	const spotifyApi = new SpotifyWebApi();
	for (user of listening) {
		try {
			const token = await methods.getToken(user);
			spotifyApi.setAccessToken(token);
			if (is_playing)
				methods.validateResponse(await spotifyApi.pause());
			else
				methods.validateResponse(await spotifyApi.play());
		} catch (error) {
			console.log(error);
		}
	}
}

buttons.previousButton = async (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	const listening = methods.getListening();
	const spotifyApi = new SpotifyWebApi();
	for (user of listening) {
		try {
			const token = await methods.getToken(user);
			spotifyApi.setAccessToken(token);
			methods.validateResponse(await spotifyApi.skipToPrevious());
		} catch (error) {
			console.log(error);
		}
	}
}

buttons.nextButton = async (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	const listening = methods.getListening();
	const spotifyApi = new SpotifyWebApi();
	for (user of listening) {
		try {
			const token = await methods.getToken(user);
			spotifyApi.setAccessToken(token);
			methods.validateResponse(await spotifyApi.skipToNext());
		} catch (error) {
			console.log(error);
		}
	}
}

buttons.likeButton = async (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	try {
		const is_saved = methods.isSaved(interaction.user.id);
		const { id } = methods.getPlayingTrack();
		const token = await methods.getToken(interaction.user.id);
		const spotifyApi = new SpotifyWebApi();
		spotifyApi.setAccessToken(token);
		if (is_saved)
			methods.validateResponse(await spotifyApi.removeFromMySavedTracks([id]), true);
		else
			methods.validateResponse(await spotifyApi.addToMySavedTracks([id]), true);
	} catch (error) {
		console.log(error);
	}
}

buttons.refreshButton = async (interaction) => {
	//TODO reset timers and cancel update queue somehow?
	methods.refreshRemote(interaction);
}

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		if (!interaction.isButton()) return;
		console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered a button: ${interaction.customId}`);
		try {
			const db = new StormDB(Engine);
			await interaction.deferUpdate();
			await buttons[interaction.customId + 'Button'](interaction);
			await methods.remote(interaction);
		} catch (error) {
			console.log(error);
		}
	},
};
