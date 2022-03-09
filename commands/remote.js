const wait = require('node:timers/promises').setTimeout;
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');
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
			if (interaction.client.lastMessage) {
					const blank = { embeds: [{
							description: '***Remote was here***'
					}], components: [] };
					interaction.client.lastMessage.edit(blank);
			}
      interaction.client.lastMessage = await interaction.editReply(message);
		} catch (error) {
			console.log(error);
			const embed = new MessageEmbed()
				.setTitle('Remote failed')
				.setDescription('not feeling like it rn');
			await interaction.reply({ embeds: [embed] });
		}
	}
};
