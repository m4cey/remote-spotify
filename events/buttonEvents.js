const SpotifyWebApi = require('spotify-web-api-node');
const logger = require('../logger.js');
const methods = require('../methods.js');

let buttons = {};

buttons.joinButton = async (interaction) => {
	const userId = interaction.user.id
	if (methods.isListener(userId)) {
		const message = methods.newMessage("you're already in the party", "wake up", true);
		interaction.followUp(message);
		return;
	}
	if (methods.isAuthenticated(userId)) {
		logger.debug('USERID: ', userId);
		const spotifyApi = new SpotifyWebApi();
		try {
			const token = await methods.getToken(userId);
			await spotifyApi.setAccessToken(token);
			const data = await spotifyApi.getMyCurrentPlaybackState();
			methods.validateResponse(data, true);
			await methods.addListener(interaction);
		} catch (error) {
			logger.error(error, 'in JoinButton():');
			if (error.status == 204) {
				const message = methods.inactiveMessage();
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
			logger.error(error);
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
			logger.error(error);
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
			logger.error(error);
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
		logger.error(error);
	} finally {
			spotifyApi.resetAccessToken();
	}
}

buttons.refreshButton = async (interaction) => {
	methods.getRefreshOnce(false);
}

buttons.playlistButton = async (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	const listening = methods.getListening();
	if (interaction.user.id != listening[0]) {
		await interaction.followUp(methods.newMessage(
		null, 'Only the leader can create/remove a playlist', true)
		);
		return;
	};
	const spotifyApi = new SpotifyWebApi();
	let id = methods.getPlaylistId();
	const onPlaylist = methods.getOnPlaylist();
	let uri;
	for (user of listening) {
		try {
			const token = await methods.getToken(user);
			spotifyApi.setAccessToken(token);
			if (onPlaylist) {
				methods.validateResponse(await spotifyApi.unfollowPlaylist(id), true);
				methods.getPlaylistOwner(null)
				methods.getOnPlaylist(false);
				methods.getPlaylistId(null);
				continue;
			}
			if (user == listening[0]) {
				id = null;
				const name = 'Remote\'s Queue';
				const options = { collaborative: true, public: false };
				const data = await spotifyApi.createPlaylist(name, options);
				methods.validateResponse(data, true);
				id = data.body.id;
				uri = data.body.uri;
				methods.validateResponse(await spotifyApi.play({context_uri: uri}));
				methods.getPlaylistOwner(user);
				methods.getOnPlaylist(true);
				methods.getPlaylistId(id);
				methods.getRefreshOnce(false);
			} else if (methods.getOnPlaylist()) {
				methods.validateResponse(await spotifyApi.followPlaylist(id), true);
			}
		} catch (error) {
			logger.error(error);
			if (user == listening[0]) {
				await interaction.followUp(
					methods.newMessage(null, 'Failed to create playlist', true)
				);
				try {
				if (id)
					methods.validateResponse(await spotifyApi.unfollowPlaylist(id), true);
				} catch (error) {
					logger.warn(error, 'failed to unfollow playlist');
				}
				methods.getPlaylistOwner(null)
				methods.getOnPlaylist(false);
				methods.getPlaylistId(null);
				methods.getRefreshOnce(false);
			}
		} finally {
			spotifyApi.resetAccessToken();
		}
	}
	methods.getRefreshOnce(false);
}

// search menu buttons

buttons.confirmSearchButton = async (interaction) => {
	methods.getIsSearching(false);
	methods.addSearchedSong(interaction);
}

buttons.cancelSearchButton = async (interaction) => {
	methods.getIsSearching(false);
	methods.getSearchIndex(0);
	methods.getSearchOffset(0);
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
		logger.debug(`${interaction.user.tag} in #${interaction.channel.name} triggered a button: ${interaction.customId}`);
		try {
			await interaction.deferUpdate();
			await buttons[interaction.customId + 'Button'](interaction);
			if (!interaction.customId.includes('Search'))
				await methods.remote(interaction);
		} catch (error) {
			logger.error(error);
		}
	},
};
