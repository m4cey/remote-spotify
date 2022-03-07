const axios = require('axios').default;
const { spotifyClientId, spotifyClientSecret, redirectUri } = require('./config.json');
const SpotifyWebApi = require('spotify-web-api-node');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('./database.js');

function apiError() {
    console.log('Something went wrong!');
}

function postGuide (interaction) {
    const url = "http://216.27.10.96:27056/guide"
    const embed = new MessageEmbed()
        .setTitle('Authentication required')
        .setDescription("visit the link for an easy guide")
        .setURL(url);
    interaction.followUp({embeds: [embed], ephemeral: true});
}

async function getToken (userId) {
    const db = new StormDB(Engine);
    const cookie = db.get('authenticated').get(userId).value();
    const options = {
        baseURL: 'https://open.spotify.com',
        url: '/get_access_token?reason=transport&productType=web_player',
        method: 'GET',
        headers: {
            'Cookie': cookie,
            'User-Agent': 'Mozilla/5.0',
        }
    };
    try {
        const res = await axios(options);
        return (res.data.accessToken);
    } catch (error) {
        console.log(error);
    }
}

async function execute (userId, callback) {
    const spotifyApi = new SpotifyWebApi();
    const db = new StormDB(Engine);

    try {
        const token = await getToken(userId);
        await spotifyApi.setAccessToken(token);
        //console.log(`<@${userId}>: `, token);
        await callback(spotifyApi, token, userId);
    } catch (error) {
        console.log(error);
    }
}

async function batchExecute (callback) {
    const spotifyApi = new SpotifyWebApi();
    const db = new StormDB(Engine);

    const listening = db.get('listening').value();
    await listening.forEach(async userId => {
        try {
            const token = await getToken(userId);
            await spotifyApi.setAccessToken(token);
            //console.log(`<@${userId}>: `, token);
            await callback(spotifyApi, token, userId);
        } catch (error) {
            console.log(error);
        }
    });
}

async function isPlaying () {
    const spotifyApi = new SpotifyWebApi();
    const db = new StormDB(Engine);

    const leaderId = db.get('listening').value()[0];
    if (leaderId) {
        try {
            const token = await getToken(leaderId);
            spotifyApi.setAccessToken(token);
            const data = await spotifyApi.getMyCurrentPlaybackState();
            return (data.body.is_playing);
        } catch {
            console.log(error);
            return (false);
        }
    }
    return (false);
}

async function getPlayingTrack () {
    const spotifyApi = new SpotifyWebApi();
    const db = new StormDB(Engine);

    const leaderId = db.get('listening').value()[0];
    if (leaderId) {
        try {
            const token = await getToken(leaderId);
            spotifyApi.setAccessToken(token);
            const data = await spotifyApi.getMyCurrentPlaybackState();
            const res = {
                artists: data.body.item.artists.map(obj => obj.name).toString(),
                title: data.body.item.name,
                cover: data.body.item.album.images[0].url || '',
                is_playing: data.body.is_playing
            };
            console.log(res);
            return (res);
        } catch (error) {
            console.log(error);
        }
    }
}

function getUserList(interaction) {
	const db = new StormDB(Engine);
	const userIds = db.get('listening').value();

	if (!userIds)	return;
	let users = '';
	userIds.forEach(user => {
      users += "<@" + user + ">\n\n";
  })
	return users;
}

async function remoteMessage (interaction) {
    const users = getUserList(interaction);
    let data = await getPlayingTrack();
    if (!data) {
        data = { title: 'nothing', artists: 'nobody', cover: 'https://picsum.photos/800' };
        data.is_playing = await isPlaying();
    }
    const embed = new MessageEmbed()
        .setTitle(`Now Playing:`)
        .setDescription(`\`\`\`${data.title} by ${data.artists}\`\`\``)
        .setThumbnail(data.cover)
        .addField("Listening:", `${users || "```no users listening```"}`)
    const partyRow = new MessageActionRow()
        .addComponents(
        new MessageButton()
            .setCustomId('join')
            .setLabel('Join')
            .setStyle('PRIMARY'),
        new MessageButton()
            .setCustomId('leave')
            .setLabel('Leave')
            .setStyle('DANGER')
            .setDisabled(!users)
        );
    const playbackRow = new MessageActionRow()
        .addComponents(
        new MessageButton()
            .setCustomId('previous')
            .setLabel("⏮️")
            .setStyle('SECONDARY'),
        new MessageButton()
            .setCustomId('play')
            .setLabel(data.is_playing ? "⏸️" : "▶️")
            .setStyle(data.is_playing ? 'SUCCESS' : 'SECONDARY'),
        new MessageButton()
            .setCustomId('next')
            .setLabel("⏭️")
            .setStyle('SECONDARY'),
        );
    return { embeds: [embed], components: [playbackRow, partyRow] }
}

async function updateRemote (interaction) {
    console.log('updating message...');
    const message = await remoteMessage(interaction);
    await interaction.editReply(message);
    console.log('message updated!');
}

function isListener (userId) {
    const db = new StormDB(Engine);
	  const listening = db.get('listening').value();
    return listening.includes(userId);
}

function addListener (interaction) {
    const db = new StormDB(Engine);
    console.log('Adding listener ' + interaction.user.tag);
    db.get('listening').push(interaction.user.id).save();
    console.log(db.get('listening').value());
}

function removeListener (interaction) {
    const db = new StormDB(Engine);
    console.log('Removing listener ' + interaction.user.tag);
    const listening = db.get('listening').value();
    if (!listening) return;
    const newListeners = listening.filter(user => user != interaction.user.id);
    db.get('listening').set(newListeners).save();
    console.log(db.get('listening').value());
    updateRemote(interaction);
}

module.exports = {
    updateRemote,
    isListener,
    addListener,
    removeListener,
    postGuide,
    batchExecute,
    execute,
    getToken,
    apiError,
    isPlaying,
    remoteMessage,
    getUserList
};
