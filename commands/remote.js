const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');

const db = new StormDB(Engine);
db.default({'listening': [], 'authenticated': {} }).save();

function getUserList(interaction) {
	const userIds = db.get('listening').value();
	if (!userIds)	return;
	let users = '';
	userIds.forEach(user => users += '<@' + user + '>\n')
	return users;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('remote')
		.setDescription('Start a party and control playback.'),

	async execute(interaction) {
		const users = getUserList(interaction);
		const embed = new MessageEmbed()
			.setTitle('Now listening')
			.setDescription(`${users || "```no users listening```"}`)
		const row = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId('join')
					.setLabel('Join')
					.setStyle('PRIMARY'),
			);
		await interaction.reply({embeds: [embed], components: [row] });
	}
};
