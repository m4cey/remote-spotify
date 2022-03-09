const axios = require('axios').default;
const { spotifyClientId, spotifyClientSecret, redirectUri } = require('./config.json');
const SpotifyWebApi = require('spotify-web-api-node');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('./database.js');

const dayjs = require('dayjs');
const duration = require('dayjs/plugin/duration');
dayjs().format();
dayjs.extend(duration);

function apiError(message, status) {
    this.message = message;
    this.status = status;
}
function validateResponse(data) {
    if (!data)
        throw new apiError("Can't connect to spotify API", 503);
    if (data.statusCode == 204)
        throw new apiError("User device is inactive", 204);
    if (data.body.error)
        throw new apiError(
            data.body.error.message,
            data.body.error.status
        );
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
        console.log("token request status: ", res.statusText, res.status);
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
        await callback(spotifyApi, token, userId);
    } catch (error) {
        console.log("in execute(): ", error);
    }
}

async function batchExecute (callback) {
    const spotifyApi = new SpotifyWebApi();
    const db = new StormDB(Engine);

    const userIds = db.get('listening').value();
    for (userId of userIds) {
        try {
            const token = await getToken(userId);
            await spotifyApi.setAccessToken(token);
            await callback(spotifyApi, token, userId);
        } catch (error) {
            console.log(error);
        }
    }
}

function getLeaderId() {
    const db = new StormDB(Engine);
    return leaderId = db.get('listening').value()[0];
}

async function isPlaying () {
    const spotifyApi = new SpotifyWebApi();

    const leaderId = getLeaderId();
    if (leaderId) {
        try {
            const token = await getToken(leaderId);
            spotifyApi.setAccessToken(token);
            const data = await spotifyApi.getMyCurrentPlaybackState();
            validateResponse(data);
            return (data.body.is_playing);
        } catch (error) {
            console.log("In isPlaying:", error);
            if (error.status == 204) {
                removeListener(leaderId);
            }
            return (false);
        }
    }
    return (false);
}

async function getPlayingTrack (userId) {
    const spotifyApi = new SpotifyWebApi();

    userId = userId || getLeaderId();
    if (userId) {
        try {
            const token = await getToken(userId);
            spotifyApi.setAccessToken(token);
            const data = await spotifyApi.getMyCurrentPlaybackState();
            validateResponse(data);
            let res = {
                artists: data.body.item.artists.map(obj => obj.name).toString(),
                title: data.body.item.name,
                cover: data.body.item.album.images[0].url,
                track: {
                    id: data.body.item.id,
                    uri: data.body.item.uri,
                    url: `https://open.spotify.com/track/${data.body.item.id}`
                },
                duration: data.body.item.duration_ms,
                progress: data.body.progress_ms,
                context: { type: data.body.context?.type, uri: data.body.context?.uri },
                is_playing: data.body.is_playing,
                userId: userId,
                album: {
                    name: data.body.item.album?.name,
                    type: data.body.item.album?.album_type,
                    id: data.body.item.album?.id,
                    url: data.body.item.album?.external_urls.spotify,
                },
                artist: {
                    name: data.body.item.artists?.[0].name,
                    url: data.body.item.artists?.[0].external_urls.spotify,
                }
            };
            const saved = await spotifyApi.containsMySavedTracks([res.track.id]);
            validateResponse(saved);
            res.is_saved = saved.body[0];
            if (res.context.type == 'playlist') {
                const id = res.context.uri.split(':')[2];
                const fields = 'collaborative,images,name,public,external_urls';
                const data = await spotifyApi.getPlaylist(id, {fields: fields});
                validateResponse(data);
                res.playlist = {
                    collaborative: data.body.collaborative,
                    public: data.body.public,
                    name: data.body.name,
                    url: data.body.external_urls.spotify
                }
            }
            return (res);
        } catch (error) {
            console.log('in getPlayingTrack(): ', error);
            if (error.status == 204) {
                removeListener(userId);
            }
        }
    }
}

async function trackIsSaved(userId) {
    const spotifyApi = new SpotifyWebApi();

    if (userId) {
        try {
            const token = await getToken(userId);
            spotifyApi.setAccessToken(token);
            let track = await getPlayingTrack(userId);
            if (!track)
                throw "track object is null";
            const data = await spotifyApi.containsMySavedTracks([track.track.id]);
            validateResponse(data);
            track.is_saved = data.body[0];
            return (track);
        } catch (error) {
            console.log("In trackIsSaved():", error);
            if (error.status == 204) {
                removeListener(userId);
            }
        }
    }
}

async function getUsername(interaction, userId) {
    if (userId) {
        const member = await interaction.guild.members.fetch(userId);
        return (member.nickname || member.user.username);
    }
}

async function getUserData(interaction) {
    const spotifyApi = new SpotifyWebApi();
    const db = new StormDB(Engine);
    const userIds = db.get('listening').value();

    if (!userIds)	return;
    let users = [];
    console.log("getUserData()");
    console.log("userIds =", userIds.length);
    for (userId of userIds) {
        try {
            let data = await getPlayingTrack(userId);
            if (!data)
                throw "data object is null";
            data.name = await getUsername(interaction, userId);
            users.push(data);
        } catch (error) {
            console.log('in getUserData().loop: ', error);
        }
    }
    console.log("users =", users.length);
    return users;
}

function getContextData(data) {
    let context = { name: '' };
    try {
        if (!data) throw "data object is null";
        if (!data.context) throw "data.context is null";
        if (!data.context.type) throw "data.context.type is null";
        const type = data.context.type;
        context = {
            name: `${type.replace(/^\w/, c => c.toUpperCase())}: ${data[type].name}`,
            url: data[type].url,
        };
    } catch (error) {
        console.log('In getContextData():', error);
    }
    return context;
}

function formatNameList(data) {
    console.log("formatNameList()");
    if (!data || !data.length)
        return 'no users listening';
    let users = '';
    for (user of data) {
        let suffix = user.is_saved ? '[❤️]' : '';
        suffix += user.is_playing ? '' : '[◼]';
        if (user.duration) {
            const progress = dayjs.duration(user.progress).format('m:ss');
            const duration = dayjs.duration(user.duration).format('m:ss');
            users  += `>${user.name}${suffix}[${progress}/${duration}]\n`;
        } else
            users += `${user.name}${suffix}\n`;
    }
    return users;
}

async function remoteMessage (data) {
    const users = formatNameList(data);
    const userCount = data.length;
    console.log('LISTENING:\n', users);
    const context = getContextData(data[0]);
    console.log("CONTEXT:", context);
    if (!data[0]) {
        const list = ['HELP!', 'PLEASE', 'GETMEOUTOFHERE', 'JUSTKEEPURCOOKIES',
            'SHEHURTSME', 'IWANTOUT', 'CALLCPS', 'HELPME', 'AAAAAAAAAAAAAAAAAAAAAAAAA'];
        data[0] = {
            title: 'nothing',
            artists: 'nobody',
            cover: `https://via.placeholder.com/600/000000/FFFFFF/?text=${
                list[Math.random() * list.length | 0]}!`
        };
        data[0].is_playing = await isPlaying();
    }
    const embed = new MessageEmbed()
        .setTitle(`Now Playing:`)
        .setDescription(`\`\`\`${data[0].title} by ${data[0].artists}\`\`\``)
        .setThumbnail(data[0].cover)
        .setAuthor(context)
        .setURL(data[0].track?.url || '')
        .addField("**Listening:**", `\`\`\`${users}\`\`\``)
    const partyRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
            .setCustomId('join')
            .setLabel('🙋')
            .setStyle('PRIMARY'),
            new MessageButton()
            .setCustomId('leave')
            .setLabel('🙅')
            .setStyle('DANGER')
            .setDisabled(!userCount),
            new MessageButton()
            .setCustomId('refresh')
            .setLabel('🧍')
            .setStyle('SECONDARY'),
            /*
            new MessageButton()
            .setCustomId('playlist')
            .setLabel('➕')
            .setStyle('SECONDARY')
            .setDisabled(!userCount),
            new MessageButton()
            .setCustomId('save')
            .setLabel('💾')
            .setStyle('SECONDARY')
            .setDisabled(true)
            */
        );
    const playbackRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
            .setCustomId('previous')
            .setLabel("⏮️")
            .setStyle('SECONDARY'),
            new MessageButton()
            .setCustomId('play')
            .setLabel(data[0].is_playing ? "⏸️" : "▶️")
            .setStyle(data[0].is_playing ? 'SUCCESS' : 'SECONDARY'),
            new MessageButton()
            .setCustomId('next')
            .setLabel("⏭️")
            .setStyle('SECONDARY'),
            new MessageButton()
            .setCustomId('like')
            .setLabel("❤️")
            .setStyle('SECONDARY'),
        );
    return { embeds: [embed], components: [playbackRow, partyRow] }
}

async function syncPlayback(interaction, users) {
    console.log(">>>syncPlayback()");
    try {
        if (!users)
            throw "data object is null";
        const leader = users[0];
        const spotifyApi = new SpotifyWebApi();
        const db = new StormDB(Engine);
        const margin = db.get('options.margin') || 10000;

        for (user of users) {
            try {
                if (user == leader)
                    continue;
                console.log(user.name, user.userId);
                const token = await getToken(userId);
                await spotifyApi.setAccessToken(token);
                let unsynced = user.is_playing != leader.is_playing;
                unsynced ||= (user.track.id == leader.track.id)
                    && (Math.abs(user.progress - leader.progress) > margin);
                unsynced ||= (user.track.id != leader.track.id)
                    && ((user.duration - user.progress) > margin);
                if (unsynced) {
                    console.log(user.userId, user.name, "UNSYNCED")
                    const options = { uris: [leader.track.uri] };
                    try {
                        validateResponse(await spotifyApi.play(options));
                    } catch (error) {
                        console.log("in syncPlayback().loop.play()", error.status);
                    }
                    try {
                        validateResponse(await spotifyApi.seek(leader.progress + 2000));
                    } catch (error) {
                        console.log("in syncPlayback().loop.seek()", error.status);
                    }
                    try {
                        if (!leader.is_playing)
                            validateResponse(await spotifyApi.pause());
                    } catch (error) {
                        console.log("in syncPlayback().loop.pause()", error.status);
                    }
                }
            } catch (error) {
                console.log('In syncPlayback().loop:', error, 'user:', userId);
            }
        }
    } catch (error) {
        console.log('In syncPlayback():', error);
    }
}

async function updateRemote (interaction, data) {
    const db = new StormDB(Engine);
    const options = db.get('options').value();

    try {
        let message;
        //checking API call interval
        if (!getLeaderId()) {
            if (interaction.client.intervalId)
                clearInterval(interaction.client.intervalId)
            interaction.client.updateOnInterval = false;
        }

        interaction.client.lastMessage ??= interaction.message;
        console.log('creating message...');
        data ??= await getUserData(interaction);
        if (data || !getLeaderId()) {
            if (data.length > 1) {
                await syncPlayback(interaction, data);
            }
            //interval to "smoothly" update progress between API calls
            const progressrate = db.get('options.progressrate').value() || 1000;
            if (getLeaderId() && data[0] && !interaction.client.progressId && data[0].is_playing &&
                db.get('options.updaterate').value() > progressrate) {
                console.log('setting progress interval');
                interaction.client.progressId =
                    setInterval(updateProgress, progressrate, interaction, data);
            } else if (getLeaderId() && !arguments[1]) {
                console.log('updating progress interval');
                clearInterval(interaction.client.progressId);
                interaction.client.progressId =
                    setInterval(updateProgress, progressrate, interaction, data);
            }
            //timeout to update on estimated track end
            try {
                if (!data[0]) throw "data object is null"
                const delay = data[0].duration - data[0].progress + 3000;
                if (!interaction.client.timeoutId || interaction.client.timeoutDelay > delay) {
                    console.log(`setting song duration timeout of ${dayjs.duration(delay).format('m:ss')}`);
                    interaction.client.timeoutDelay = delay;
                    if (interaction.client.timeoutId)
                        clearTimeout(interaction.client.timeoutId);
                    interaction.client.timeoutId =
                        setTimeout(onTrackChange, delay, interaction);
                }
            } catch (error) {
                console.log('in updateRemote()(timeout)', error);
            }
            message = await remoteMessage(data);
            console.log('message has been created!');
        } else console.log('USING PREVIOUS MESSAGE!!');
        message ??= interaction.client.oldMessage;
        let followup = false;
        if (options.followup) {
            followup = true;
            const collection = interaction.channel.messages.cache;
            let threshold = options.threshold;
            for (let i = -1; Math.abs(i) <= threshold; i-- ) {
                const message = collection.get(collection.keyAt(i));
                if (message.applicationId == interaction.message.applicationId) {
                    followup = false;
                    break;
                }
            }
        }
        if (followup) {
            console.log("following up reply...");
            const blank = { embeds: [{
                description: '***Remote was here***'
            }], components: [] };
            interaction.editReply(blank);
            interaction.client.lastMessage.edit(blank);
            interaction.client.lastMessage = await interaction.followUp(message);
        } else {
            if (JSON.stringify(interaction.client.oldMessage) != JSON.stringify(message)) {
                console.log("edititing reply...");
                await interaction.client.lastMessage.edit(message);
            } else
                console.log("skipping message update, identical");
            interaction.client.oldMessage = message;
        }
        console.log('message updated!');
    } catch (error) {
        console.error('In updateRemote(): ', error);
    }
}

async function updateProgress(interaction, data) {
    try {
        if (!data[0]) throw "data object is null"
        if (!getLeaderId() || !data[0].is_playing) {
            console.log('clearing progress interval');
            clearInterval(interaction.client.progressId);
            interaction.client.progressId = 0;
            return;
        }
        const db = new StormDB(Engine);
        const progressrate = db.get('options.progressrate').value() || 1000;
        data.forEach( user => user.progress += progressrate);
        await updateRemote(interaction, data);
    } catch (error) {
        console.error('in updateProgress(): ', error);
    }
}

async function onTrackChange (interaction) {
    console.log("track change update");
    interaction.client.timeoutId = 0;
    interaction.client.timeoutDelay = 0;
    await updateRemote(interaction);
}

function isListener (userId) {
    const db = new StormDB(Engine);
    const userIds = db.get('listening').value();
    return userIds.includes(userId);
}

function addListener (interaction) {
    const db = new StormDB(Engine);
    console.log('Adding listener ' + interaction.user.tag);
    db.get('listening').push(interaction.user.id).save();
    console.log(db.get('listening').value());
}

function removeListener (userId) {
    const db = new StormDB(Engine);
    console.log('Removing listener ', userId);
    const userIds = db.get('listening').value();
    if (!userIds) return;
    const newListeners = userIds.filter(user => user != userId);
    db.get('listening').set(newListeners).save();
    console.log(db.get('listening').value());
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
    validateResponse,
    isPlaying,
    remoteMessage,
    getUserData,
    trackIsSaved,
    getUsername,
    getPlayingTrack,
    getLeaderId
};
