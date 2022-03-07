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
		await interaction.deferReply();
		const users = methods.getUserList(interaction);
		const message = await methods.remoteMessage(interaction);
		await interaction.editReply(message);
		} catch (error) {
			console.log(error);
			interaction.reply({ content: 'not feeling like it rn' });
		}
	}
};
