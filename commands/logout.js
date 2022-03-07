const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('logout')
		.setDescription('remove your credentials from database'),
	async execute(interaction) {
		const db = new StormDB(Engine);
		const loggedIn = db.get('authenticated').get(interaction.user.id).value();
		if (loggedIn)
			db.get('authenticated').get(interaction.user.id).delete();
		db.save();
		const embed = new MessageEmbed()
			.setTitle(loggedIn ? 'Logged out' : 'Not logged in yet')
			.setDescription(loggedIn ? 'good riddance' : '**NO LEAVING BEFORE YOU GIVE ME SOMETHING FIRST SHITHEAD**');

		await interaction.reply({ embeds: [embed] });
	}
};
