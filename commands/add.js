const logger = require('../logger.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('../database.js');
const methods = require('../methods.js');
const SpotifyWebApi = require('spotify-web-api-node');

module.exports = {
	data: new SlashCommandBuilder()
	.setName('add')
	.setDescription('Add a song to the current playlist')
	.addSubcommand(subcommand =>
		subcommand.setName('url')
		.setDescription('Add a song through it\'s URL')
		.addStringOption(option =>
			option
			.setName('url')
			.setDescription('eg: https://open.spotify.com/track/4RdpSi00jdvfRLZb3Q1WhB')
			.setRequired(true)))
	.addSubcommand(subcommand =>
		subcommand.setName('search')
		.setDescription('Search for a track providing a title and/or artist name')
		.addStringOption(option =>
			option
			.setName('title')
			.setDescription('Song\'s title'))
		.addStringOption(option =>
			option
			.setName('artist')
			.setDescription('Song\'s artist'))),

	async execute(interaction) {
		const command = interaction.options.getSubcommand();
		if (methods.getIsSearching()) {
			interaction.reply(methods.message(null, 'patience??', true));
			return;
		}
		if (!methods.getOnPlaylist()) {
			interaction.reply(
				methods.newMessage(null, 'and where do you want me to add this to...', true)
			);
			return;
		}
		methods.getIsSearching(true);
		const spotifyApi = new SpotifyWebApi();
		try {
			if (command == 'url') {
				const url = interaction.options.getString('url');
				if (!url.includes('open.spotify.com/track/')) {
					methods.getIsSearching(false);
					await interaction.reply(
						methods.newMessage(null, 'maybe learn to copy your links better', true)
					);
					return;
				}
				const id = url.slice(31).split('?')[0];
				try {
					await interaction.deferReply();
					const token = await methods.getToken(interaction.user.id);
					if (!token) throw "No token provided"
					await spotifyApi.setAccessToken(token);
					let track = await spotifyApi.getTrack(id);
					methods.validateResponse(track, true);
					methods.getSearchIndex(0);
					track = track.body;
					track.artists = track.artists.map(obj => obj.name).join();
					track.cover = track.album?.images?.[0]?.url;
					const data = { tracks: [track], offset: 0, total: 1 };
					const message = methods.searchMessage(interaction, data, true);
					await interaction.editReply(message);
					methods.getIsSearching(false);
					// actually add the song here
					methods.addToPlaylist(track.uri);
				} catch (error) {
					logger.error(error, "in execute().url");
				}
			} else {
				const title = interaction.options.getString('title');
				const artist = interaction.options.getString('artist');
				if (!artist && !title) {
					methods.getIsSearching(false);
					await interaction.reply(methods.newMessage(null, 'ahaha, dumbass', true));
					return;
				}
				try {
					await interaction.deferReply();
					methods.getSearchIndex(0);
					const query = (title ? `track:${title}` : '') + (title && artist ? '+' : '') +
						(artist ? `artist:${artist}` : '');
					logger.debug('QUERY:', query);
					const data = await methods.getSearchData(interaction, query);
					const message = methods.searchMessage(interaction, data, false);
					await interaction.editReply(message);
					// song will be added through button events
				} catch (error) {
					logger.error(error, "in execute().search");
				}
			}
		} catch (error) {
			logger.error(error, "in execute():");
			if (error.status == 204) {
				const message = methods.inactiveMessage();
				interaction.followUp(message);
				return;
			}
			await interaction.editReply(methods.failedMessage());
		} finally {
			spotifyApi.resetAccessToken();
		}
	}
};
