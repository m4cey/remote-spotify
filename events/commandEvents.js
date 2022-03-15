const logger = require('../logger.js');
module.exports = {
	name: 'interactionCreate',
	execute(interaction) {
		if (!interaction.isCommand())	return;
		logger.debug(`${interaction.user.tag} in #${interaction.channel.name} triggered a command.`);
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) return;

		try {
			command.execute(interaction);
		} catch (error) {
			logger.error(error)
			interaction.reply({ content: 'no work, sorry :(', ephemeral: true });
		}
	},
};
