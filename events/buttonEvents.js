const StormDB = require("stormdb");
const methods = require('../methods.js');
const { Engine } = require('../database.js');
const db = new StormDB(Engine);

let buttons = {};

buttons.joinButton = (interaction) => {
	const listening = db.get('listening').value();
	if (listening.includes(interaction.user.id))
		return;
	const authIds = db.get('authenticated').value().map(obj => Object.keys(obj)[0]);
	if (authIds.includes(interaction.user.id))
		methods.addListener(interaction);
	else {
		methods.generateAuthLink(interaction);
	}
}

module.exports = {
	name: 'interactionCreate',
	execute(interaction) {
		if (!interaction.isButton())	return;
		console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered a button: ${interaction.customId}`);

		buttons[interaction.customId + 'Button'](interaction);
	},
};
