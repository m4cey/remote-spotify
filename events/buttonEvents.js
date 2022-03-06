const StormDB = require("stormdb");
const methods = require('../methods.js');
const state = require('../state.js');
const { Engine } = require('../database.js');
const db = new StormDB(Engine);

let buttons = {};

buttons.joinButton = (interaction) => {
	const db = new StormDB(Engine);
	if (methods.isListener(interaction.user.id)) {
		interaction.reply({ content: "```you're already in the party```", ephemeral: true });
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

buttons.playButton = (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	methods.updateRemote(interaction);
	const leader = db.get('listening').value()[0];
	let leaderToken;
	methods.batchExecute((spotifyApi, token, userId) => {
		if (userId == leader)
			leaderToken = token;
		spotifyApi.setAccessToken(leaderToken);
		spotifyApi.getMyCurrentPlaybackState().then(data => {
			spotifyApi.setAccessToken(token);
			if (data.body && data.body.is_playing) {
				state.setPlaying(false);
				spotifyApi.pause();
			}
			else {
				state.setPlaying(true);
				spotifyApi.play();
			}
		});
	});
}

buttons.previousButton = (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	methods.updateRemote(interaction);
	methods.batchExecute((spotifyApi, token, userId) => {
		spotifyApi.skipToPrevious().then(() => state.previousTrack());
	});
}

buttons.nextButton = (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	methods.updateRemote(interaction);
	methods.batchExecute((spotifyApi, token, userId) => {
		spotifyApi.skipToNext().then(() => state.nextTrack());
	});
}

buttons.likeButton = (interaction) => {
	if (!methods.isListener(interaction.user.id)) return 0;
	methods.updateRemote(interaction);
	methods.execute(interaction.user.id, (spotifyApi, token, userId) => {
		spotifyApi.getMyCurrentPlaybackState().then(data => {
			return data.body.item.id;
		}).then(id => {
			spotifyApi.containsMySavedTracks([id]).then((data, id) => {
				if (data.body[0])
					spotifyApi.removeFromMySavedTracks([data.id]);
				else
					spotifyApi.addToMySavedTracks([data.id])
			});
		});
	});
}

module.exports = {
	name: 'interactionCreate',
	execute(interaction) {
		if (!interaction.isButton())	return;
		console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered a button: ${interaction.customId}`);

		buttons[interaction.customId + 'Button'](interaction);
	},
};
