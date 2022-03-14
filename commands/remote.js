const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const methods = require('../methods.js');

module.exports = {
	data: new SlashCommandBuilder()
	.setName('remote')
	.setDescription('Start a party and control playback.'),

	async execute(interaction) {
		try {
			console.log(`interaction ${interaction.id} beggining deferral`);
			await interaction.deferReply();
			console.log(`interaction ${interaction.id} has been deferred`);
			const data = await methods.getUserData(interaction);
			const message = await methods.remoteMessage(data);
			const lastMessage = methods.getLastMessage();
			if (lastMessage)
				lastMessage.edit(methods.blankMessage());
			methods.setLastMessage(await interaction.editReply(message));
		} catch (error) {
			console.log(error);
			await interaction.reply(methods.failedMessage());
		}
	}
};
