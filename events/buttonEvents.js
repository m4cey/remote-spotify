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
		const spotifyApi = new SpotifyWebApi();
		try {
			const token = await methods.getToken(userId);
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
		} finally {
			spotifyApi.resetAccessToken();
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
		} finally {
			spotifyApi.resetAccessToken();
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
		} finally {
			spotifyApi.resetAccessToken();
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
		} finally {
			spotifyApi.resetAccessToken();
		}
	}
}

buttons.likeButton = async (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	const spotifyApi = new SpotifyWebApi();
	const is_saved = methods.isSaved(interaction.user.id);
	const { id } = methods.getPlayingTrack();
	try {
		const token = await methods.getToken(interaction.user.id);
		spotifyApi.setAccessToken(token);
		if (is_saved)
			methods.validateResponse(await spotifyApi.removeFromMySavedTracks([id]), true);
		else
			methods.validateResponse(await spotifyApi.addToMySavedTracks([id]), true);
	} catch (error) {
		console.log(error);
	} finally {
			spotifyApi.resetAccessToken();
	}
}

buttons.refreshButton = async (interaction) => {
	methods.refreshRemote(interaction);
}

buttons.playlistButton = async (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	const listening = methods.getListening();
	const spotifyApi = new SpotifyWebApi();
	for (user of listening) {
		try {
			const token = await methods.getToken(user);
			spotifyApi.setAccessToken(token);
			let id = methods.getPlaylistId();
			const onPlaylist = methods.getOnPlaylist();
			if (onPlaylist) {
				methods.validateResponse(await spotifyApi.unfollowPlaylist(id), true);
				methods.getOnPlaylist(false);
				methods.getPlaylistId(null);
				continue;
			}
			if (user == listening[0]) {
				const name = 'Remote\'s Queue';
				const options = { collaborative: true, public: false };
				const data = await spotifyApi.createPlaylist(name, options);
				methods.validateResponse(data, true);
				methods.validateResponse(await spotifyApi.play({context_uri: data.body.uri}));
				methods.validateResponse(await spotifyApi.pause());
				id = data.body.id;
				methods.getPlaylistId(id);
				methods.getOnPlaylist(true);
			} else {
				methods.validateResponse(await spotifyApi.followPlaylist(id), true);
			}
		} catch (error) {
			console.log(error);
		} finally {
			spotifyApi.resetAccessToken();
		}
	}
}

// search menu buttons

buttons.confirmSearchButton = async (interaction) => {
	methods.getIsSearching(false);
	methods.addSearchedSong(interaction);
}

buttons.cancelSearchButton = async (interaction) => {
	methods.getIsSearching(false);
	interaction.deleteReply();
}

buttons.previousSearchButton = async (interaction) => {
	const index = methods.getSearchIndex() - 1;
	methods.getSearchIndex(index);
	await methods.updateSearch(interaction);
}

buttons.nextSearchButton = async (interaction) => {
	const index = methods.getSearchIndex() + 1;
	methods.getSearchIndex(index);
	await methods.updateSearch(interaction);
}

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		if (!interaction.isButton()) return;
		console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered a button: ${interaction.customId}`);
		try {
			await interaction.deferUpdate();
			await buttons[interaction.customId + 'Button'](interaction);
			if (!interaction.customId.includes('Search'))
				await methods.remote(interaction);
		} catch (error) {
			console.log(error);
		}
	},
};
