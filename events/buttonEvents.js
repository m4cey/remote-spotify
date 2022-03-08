const wait = require('node:timers/promises').setTimeout;
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
			await methods.execute(userId, async (spotifyApi, token, userId) => {
				const data = await spotifyApi.getMe();
				if (!data)
						throw "Can't connect to Spotify API"
				console.log('SPOTIFY USER:', data.body.display_name, data.body.email);
			});
			methods.addListener(interaction);
			interaction.client.updateOnInterval = true;
		} catch (error) {
			console.log('in JoinButton(): ', error);
		}
	}
	else
		methods.postGuide(interaction);
}

buttons.leaveButton = (interaction) => {
	methods.removeListener(interaction);
	if (!methods.getLeaderId && interaction.client.intervalId) {
		clearInterval(interaction.client.intervalId);
		interaction.client.intervalId = 0;
		interaction.client.updateOnInterval = false;
	}
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

buttons.likeButton = async (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	await methods.execute(interaction.user.id, async (spotifyApi, token, userId) => {
		try {
			const data = await methods.trackIsSaved(userId);
			if (data.is_saved)
				await spotifyApi.removeFromMySavedTracks([data.id]);
			else
				await spotifyApi.addToMySavedTracks([data.id]);
		} catch (error) {
			console.log(error);
		}
	});
}

buttons.refreshButton = async (interaction) => {
	await wait(1000);
}

module.exports = {
	name: 'interactionCreate',
	async execute(interaction) {
		if (!interaction.isButton()) return;
		console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered a button: ${interaction.customId}`);
		try {
			await interaction.deferUpdate();
			console.log(interaction.customId, ':interaction has been deferred');
			await buttons[interaction.customId + 'Button'](interaction);
			console.log(interaction.customId, ':button function has finished');
			console.log(interaction.customId, ':beggining message update');
			await methods.updateRemote(interaction);
			if (interaction.client.updateOnInterval) {
					if (interaction.client.intervalId)
							clearInterval(interaction.client.intervalId)
				const delay = db.get('options').get('updaterate').value() * 1000 || 3000;
				console.log(`setting an interval of ${delay} milliseconds`);
				interaction.client.intervalId =
					setInterval(methods.updateRemote, delay, interaction);
			}
		} catch (error) {
			console.log(error);
		}
	},
};
