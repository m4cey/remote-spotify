const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('ping pong'),
	async execute(interaction) {
		const keyword = interaction.options.getString('keyword');
		await interaction.reply('pong');
	},
};
