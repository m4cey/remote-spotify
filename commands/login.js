const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('login')
		.setDescription('register your credentials with a cookie string')
		.addStringOption(option =>
				option.setName('cookies')
					.setDescription('the cookies generated on your browser when visiting open.spotify.com')
					.setRequired(true)),
	async execute(interaction) {
		const db = new StormDB(Engine);
		const cookies = interaction.options.getString('cookies');
		db.get('authenticated').get(interaction.user.id).set(cookies).save();
		const embed = new MessageEmbed()
			.setTitle('Logged in')
			.setDescription('you can now join a party');

		await interaction.reply({ embeds: [embed], ephemeral: true });
	}
};
