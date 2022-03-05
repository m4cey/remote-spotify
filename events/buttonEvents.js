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
		methods.generateAuthLink(interaction);
}

buttons.leaveButton = (interaction) => {
	methods.removeListener(interaction);
}

buttons.playButton = (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	state.setPlaying(!state.isPlaying());
	methods.updateRemote(interaction);
}

buttons.previousButton = (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	state.previousTrack();
	methods.updateRemote(interaction);
}

buttons.nextButton = (interaction) => {
	if (!methods.isListener(interaction.user.id)) return;
	state.nextTrack();
	methods.updateRemote(interaction);
}

buttons.likeButton = (interaction) => {
	if (!methods.isListener(interaction.user.id)) return 0;
	state.likeTrack(interaction);
	methods.updateRemote(interaction);
}

module.exports = {
	name: 'interactionCreate',
	execute(interaction) {
		if (!interaction.isButton())	return;
		console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered a button: ${interaction.customId}`);

		buttons[interaction.customId + 'Button'](interaction);
	},
};
