const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('login')
		.setDescription('register your credentials with an access token')
		.addStringOption(option =>
				option.setName('access-token')
					.setDescription('the access token generated on your browser')
					.setRequired(true)),
	async execute(interaction) {
		const db = new StormDB(Engine);
		const token = interaction.options.getString('access-token');
		db.get('authenticated').get(interaction.user.id).set(token).save();
		const embed = new MessageEmbed()
			.setTitle('Logged in')
			.setDescription('you can now join a party');

		await interaction.reply({ embeds: [embed], ephemeral: true });
	}
};
