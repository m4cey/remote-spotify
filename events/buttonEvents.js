const StormDB = require("stormdb");
const methods = require('../methods.js');
const { Engine } = require('../database.js');
const db = new StormDB(Engine);

let buttons = {};

buttons.joinButton = (interaction) => {
	const db = new StormDB(Engine);
	const listening = db.get('listening').value();
	if (listening.includes(interaction.user.id)) {
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

module.exports = {
	name: 'interactionCreate',
	execute(interaction) {
		if (!interaction.isButton())	return;
		console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered a button: ${interaction.customId}`);

		buttons[interaction.customId + 'Button'](interaction);
	},
};
