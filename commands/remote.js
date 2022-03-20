const logger = require('../logger.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const methods = require('../methods.js');

module.exports = {
	data: new SlashCommandBuilder()
	.setName('remote')
	.setDescription('Start a party and control playback.'),

	async execute(interaction) {
		try {
			logger.debug(`interaction ${interaction.id} beggining deferral`);
			await interaction.deferReply();
			logger.debug(`interaction ${interaction.id} has been deferred`);
			const data = await methods.getUserData(interaction);
			if (data?.length)
      	data[0].queue = await methods.getQueue(data[0], 10);
			const message = await methods.remoteMessage(data);
			const lastMessage = methods.getLastMessage();
			if (lastMessage)
				lastMessage.edit(methods.blankMessage());
			methods.setLastMessage(await interaction.editReply(message));
		} catch (error) {
			logger.error(error);
			await interaction.reply(methods.failedMessage());
		}
	}
};
