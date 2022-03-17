const logger = require('../logger.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const puppeteer = require('puppeteer-core');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');
const methods = require('../methods.js');

module.exports = {
	data: new SlashCommandBuilder()
	.setName('login')
	.setDescription('Your logins are only used to generate session cookies and will not be saved')
	.addStringOption(option =>
		option.setName('email')
		.setDescription('Your Spotify Email address')
		.setRequired(true))
	.addStringOption(option =>
		option.setName('password')
		.setDescription('Your Spotify password')
		.setRequired(true)),
	async execute(interaction) {
		try {
			await interaction.deferReply();
			const db = new StormDB(Engine);
			const email = interaction.options.getString('email');
			const password = interaction.options.getString('password');
			// puppeteer
			const browser = await puppeteer.launch({
				executablePath: '/snap/bin/chromium'
			});
			const page = await browser.newPage();
			await page.goto('https://accounts.spotify.com/login');
			await page.type('#login-username', email);
			await page.type('#login-password', password);
			await page.click('#login-button');
			await page.waitForNavigation();
			const cookies = await page.cookies();
			let { value, expires } = cookies?.find(crumb => crumb.name == 'sp_dc');

			await browser.close();
			let success = false;
			if (value) {
				const oldCookie = db.get('authenticated').get(interaction.user.id).value();
				db.get('authenticated').get(interaction.user.id).set(`sp_dc=${value}`).save();
				try {
					const token = await methods.getToken(interaction.user.id);
					if (token && token.length >= 312)
						success = true
				} catch (error) {
					logger.error(error);
					success = false;
				} finally {
					if (!success) {
						if (oldCookie)
							db.get('authenticated').get(interaction.user.id).set(oldCookie);
						else
							db.get('authenticated').get(interaction.user.id).delete();
						db.save();
					}
				}
			}
			const embed = new MessageEmbed()
				.setTitle(success ? 'Logged in' : 'Login failed')
				.setDescription(success ? `Your session will expire in ${
					(new Date(new Date().getTime() + expires)).toString().slice(0, 15)
				}` : 'Make sure your logins are correct and try again.');

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			logger.error(error);
			await interaction.reply(methods.failedMessage());
		}
	}
};
