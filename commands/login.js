const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');
const methods = require('../methods.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('login')
		.setDescription('register your credentials with a cookie string')
		.addStringOption(option =>
				option.setName('cookies')
					.setDescription('the cookies generated on your browser when visiting open.spotify.com')
					.setRequired(true)),
	async execute(interaction) {
		try {
			console.log(`interaction ${interaction.id} beggining deferral`);
			await interaction.deferReply();
			console.log(`interaction ${interaction.id} has been deferred`);
			const db = new StormDB(Engine);
			const cookies = interaction.options.getString('cookies');
			let success = false;
			if (cookies) {
				const oldCookies = db.get('authenticated').get(interaction.user.id).value();
				db.get('authenticated').get(interaction.user.id).set(cookies).save();
				try {
					const token = await methods.getToken(interaction.user.id);
					if (token.length >= 312)
						success = true
				} catch (error) {
					console.log(error);
					if (oldCookies)
						db.get('authenticated').get(interaction.user.id).set(oldCookies);
					else
						db.get('authenticated').get(interaction.user.id).delete();
					db.save();
					success = false;
				}
				if (!success) {
					if (oldCookies)
						db.get('authenticated').get(interaction.user.id).set(oldCookies);
					else
						db.get('authenticated').get(interaction.user.id).delete();
					db.save();
				}
			}
			const embed = new MessageEmbed()
				.setTitle(success ? 'Logged in' : 'Login failed')
				.setDescription(success ? 'fine ig, you can join a party' :
				'it\'s rotten cookies, I will fucking kill you');

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.log(error);
			const embed = new MessageEmbed()
				.setTitle('Remote failed')
				.setDescription('not feeling like it rn');
			await interaction.reply({ embeds: [embed] });
		}
	}
};
