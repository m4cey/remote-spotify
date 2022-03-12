require('dotenv').config();
const axios = require('axios').default;
const SpotifyWebApi = require('spotify-web-api-node');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const StormDB = require("stormdb");
const { Engine } = require('./database.js');

const dayjs = require('dayjs');
const duration = require('dayjs/plugin/duration');
dayjs().format();
dayjs.extend(duration);

let listening = [];
let state = [];
let queue = {};
let lastMessage;
let oldMessage;
let updateOnInterval;
let updateIntervalId;
let refreshOnInterval;
let refreshIntervalId;
let timeoutId;
let timeoutDelay;

function apiError(message, status) {
    this.message = message;
    this.status = status;
}

function validateResponse(data, device_error) {
    if (!data)
        throw new apiError("Can't connect to spotify API", 503);
    if (device_error && data.statusCode == 204)
        throw new apiError("User device is inactive", 204);
    if (data.body.error)
        throw new apiError(
            data.body.error.message,
            data.body.error.status
        );
}

function postGuide (interaction) {
    const url = `${process.env.domain}`
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
        console.log("in execute():", error);
    }
}

async function batchExecute (callback) {
    const spotifyApi = new SpotifyWebApi();

    for (userId of listening) {
        try {
            const token = await getToken(userId);
            await spotifyApi.setAccessToken(token);
            await callback(spotifyApi, token, userId);
        } catch (error) {
            console.log('In batchExecute():', error);
        }
    }
}

function getLeaderId() {
    return leaderId = listening[0];
}

function getListening() {
    return listening;
}

function getPlayingTrack () {
    return { id: state[0].track.id, is_playing: state[0].is_playing }
}

function isSaved(userId) {
    if (userId && listening[userId]) {
        return state[userId].is_saved;
    }
}


async function getQueue(data, limit) {
    console.log(">>>getQueue()");
    const spotifyApi = new SpotifyWebApi();
    try {
        if (!data) throw 'data object is null'
        if (!data.context) throw 'context object is null'
        if (!data.context.type) throw 'type object is null'
        const token = await getToken(data.userId);
        spotifyApi.setAccessToken(token);
        let index = 0;
        let found = false;
        let done = false;
        let tracks;
        if (data.queue?.index && data.queue?.tracks.length) {
            console.log("SKIPPING SEARCH TO CURRENT INDEX");
            data.queue.index++;
            index = data.queue.index;
            found = true;
        }
        do {
            if (found) {
                console.log('MATCH FOUND', index);
                done = found;
            }
            const options = {
                fields: 'items(track(id,uri,name)),total',
                limit: limit,
                offset: index + found
            };
            if (data.context.type == 'playlist')
                tracks = await spotifyApi.getPlaylistTracks(data.playlist.id, options);
            else if (data.context.type == 'album')
                tracks = await spotifyApi.getAlbumTracks(data.album.id, options);
            validateResponse(tracks, true);
            if (data.context.type == 'album')
                tracks.body.items = tracks.body.items.map(item => { return {
                    track: { id: item.id, name: item.name, uri: item.uri }
                }});
            if (!found) {
                index = tracks.body.items.findIndex(item =>
                    item.track.id == data.track.id);
                if (index < 0 && tracks.body.items.length < limit) {
                    throw "couldn't find original track within the playlist"
                }
                found = index >= 0;
                index = index >= 0 ?
                    index + options.offset : options.offset + options.limit;
            }
        } while (!found || !done);
        let queue = { tracks: [], index: index, total: tracks.body.total };
        tracks.body.items.forEach(item => queue.tracks.push(item.track));
        return queue;
    } catch (error) {
        console.log('in getQueue():', error);
        return { index: 0, tracks: [], total: 0 }
    }
}

async function getPlaybackData (userId) {
    const spotifyApi = new SpotifyWebApi();

    userId = userId || getLeaderId();
    if (userId) {
        try {
            const token = await getToken(userId);
            spotifyApi.setAccessToken(token);
            const data = await spotifyApi.getMyCurrentPlaybackState();
            validateResponse(data, true);
            let res = {
                artists: data.body.item.artists.map(obj => obj.name).toString(),
                title: data.body.item.name,
                cover: data.body.item.album.images[0].url,
                track: {
                    id: data.body.item.id,
                    uri: data.body.item.uri,
                    url: `https://open.spotify.com/track/${data.body.item.id}`,
                },
                duration: data.body.item.duration_ms,
                progress: data.body.progress_ms,
                context: {
                    type: data.body.context?.type,
                    uri: data.body.context?.uri,
                },
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
            validateResponse(saved, true);
            res.is_saved = saved.body[0];
            if (res.context.type == 'playlist') {
                const id = res.context.uri.split(':')[2];
                const options = {
                    fields: 'collaborative,name,public,external_urls'
                };
                const data = await spotifyApi.getPlaylist(id, options);
                validateResponse(data, true);
                res.playlist = {
                    collaborative: data.body.collaborative,
                    public: data.body.public,
                    name: data.body.name,
                    url: data.body.external_urls.spotify,
                    id: id
                }
            }
            return (res);
        } catch (error) {
            console.log('in getPlaybackData(): ', error);
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

    if (!listening.length) return;
    let users = [];
    console.log("getUserData()");
    for (userId of listening) {
        try {
            let data = await getPlaybackData(userId);
            if (!data)
                throw "data object is null";
            data.name = await getUsername(interaction, userId);
            users.push(data);
        } catch (error) {
            console.log('in getUserData().loop: ', error);
        }
    }
    return users;
}

function getContextData(data) {
    let context = { name: '' };
    try {
        if (!data || !data.length) throw "data object is null or empty";
        if (!data.context) throw "data.context is null";
        if (!data.context.type) throw "data.context.type is null";
        if (data.context.type == 'artist') throw "artist context not supported";
        console.log("CONTEXT:", data.context);
        const type = data.context.type;
        const index = data.queue ? ` (${data.queue.index + 1}/${data.queue.total})` : '';
        context = {
            name: `${type.replace(/^\w/, c => c.toUpperCase())}: ${data[type].name}${index}`,
            url: data[type].url,
        };
    } catch (error) {
        console.log('In getContextData():', error);
    }
    return context;
}

function formatNameList(data) {
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

function formatQueue(data) {
    if (!data?.queue) return;
    const amount = Math.min(4, data.queue.tracks.length);
    let queue = '';
    for (let i = 0; i < amount; i++) {
        queue += `${data.queue.index + 2 + i} - ${data.queue.tracks[i].name}\n`;
    }
    return queue;
}

async function remoteMessage (data) {
    const users = formatNameList(data);
    const userCount = data ? data.length : 0;
    const context = getContextData(data ? data[0] : null);
    console.log("CONTEXT:", context);
    const queue = formatQueue(data ? data[0] : null);
    if (!data || !data[0]) {
        data = [{}];
        const list = ['HELP!', 'PLEASE', 'GETMEOUTOFHERE', 'JUSTKEEPURCOOKIES',
            'SHEHURTSME', 'IWANTOUT', 'CALLCPS', 'HELPME', 'AAAAAAAAAAAAAAAAAAAAAAAAA'];
        data[0] = {
            title: 'nothing',
            artists: 'nobody',
            cover: `https://via.placeholder.com/600/000000/FFFFFF/?text=${
                list[Math.random() * list.length | 0]}!`
        };
        data[0].is_playing = false;
    }
    let fields = [
        { name: "Listening:", value: `\`\`\`${users}\`\`\`` }
    ];
    if (queue)
        fields.push({ name: 'Next up:', value: `\`\`\`${queue}\`\`\`` });
    const embed = new MessageEmbed()
        .setTitle(`Now Playing:`)
        .setDescription(`\`\`\`${data[0].title} by ${data[0].artists}\`\`\``)
        .setThumbnail(data[0].cover)
        .setAuthor(context)
        .setURL(data[0].track?.url || '')
        .addFields(fields);
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

async function syncPlayback(users) {
    console.log(">>>syncPlayback()");
    try {
        if (!users)
            throw "data object is null";
        const leader = users[0];
        const spotifyApi = new SpotifyWebApi();
        const db = new StormDB(Engine);
        const margin = db.get('options.margin').value() || 10000;
        const sync_context = db.get('options.sync_context').value() || true;

        for (user of users) {
            try {
                if (user == leader || user.skipping)
                    continue;
                console.log('>', leader.name, leader.userId, leader.track.id);
                console.log(user.name, user.userId, user.track.id);
                const token = await getToken(userId);
                await spotifyApi.setAccessToken(token);
                let unsynced = user.is_playing != leader.is_playing;
                unsynced ||= (user.track.id == leader.track.id)
                    && (Math.abs(user.progress - leader.progress) > margin);
                unsynced ||= (user.track.id != leader.track.id)
                    && ((user.duration - user.progress) > margin);
                unsynced ||= user.new;
                if (unsynced) {
                    console.log(user.userId, user.name, ">>>>UNSYNCED")
                    try {
                        if (user.track.id != leader.track.id) {
                            if (sync_context && leader.queue.tracks.length) {
                                let unsynced = (user.track.id != leader.track.id)
                                    && ((user.duration - user.progress) > margin);
                                if (unsynced) {
                                    const options = { context_uri: leader.context.uri };
                                    validateResponse(await spotifyApi.play(options));
                                    user.skipping = leader.queue.index > 0;
                                    for (let i = 0; i < leader.queue.index; i++) {
                                        console.log("SKIPPING TRACK:",
                                            i+1, '/', leader.queue.index);
                                        validateResponse(await spotifyApi.skipToNext());
                                    }
                                }
                            } else {
                                const options = { uris: [leader.track.uri] };
                                validateResponse(await spotifyApi.play(options));
                            }
                        }
                    } catch (error) {
                        console.log("in syncPlayback().loop.play()", error.status);
                    }
                    try {
                        validateResponse(await spotifyApi.seek(leader.progress
                            + leader.is_playing * 2000));
                    } catch (error) {
                        console.log("in syncPlayback().loop.seek()", error.status);
                    }
                    try {
                        if (!leader.is_playing)
                            validateResponse(await spotifyApi.pause());
                    } catch (error) {
                        console.log("in syncPlayback().loop.pause()", error.status);
                    }
                    try {
                        if (!sync_context)
                            validateResponse(
                                await spotifyApi.addToQueue(leader.queue.tracks[0].uri)
                            );
                    } catch (error) {
                        console.log("in syncPlayback().loop.queue()", error.status);
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
async function updateQueue(users) {
    console.log(">>>updateQueue()");
    try {
        if (!users)
            throw "users object is null";
        const leader = users[0];
        const spotifyApi = new SpotifyWebApi();

        for (user of users) {
            try {
                if (user == leader)
                    continue;
                console.log(user.name, user.userId);
                const token = await getToken(userId);
                await spotifyApi.setAccessToken(token);
                validateResponse(
                    await spotifyApi.addToQueue(leader.queue.tracks[0].uri)
                );
            } catch (error) {
                console.log('In updateQueue().loop:', error, 'user:', userId);
            }
        }
    } catch (error) {
        console.log('In updateQueue():', error);
    }
}

async function refreshRemote (interaction) {
    const db = new StormDB(Engine);
    const options = db.get('options').value();

    if (!getLeaderId()) {
        if (refreshIntervalId)
            clearInterval(refreshIntervalId)
        refreshOnInterval = false;
    }

    console.log('creating message...');
    message = await remoteMessage(state);
    console.log('message has been created!');
    message ??= oldMessage;
    // followup threshold test
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
        lastMessage.edit(blank);
        lastMessage = await interaction.followUp(message);
    } else {
        if (JSON.stringify(oldMessage) != JSON.stringify(message)) {
            console.log("edititing reply...");
            await lastMessage.edit(message);
            console.log("message refreshed");
        } else
            console.log("skipping message refresh, identical");
        oldMessage = message;
    }
}

async function updateRemote (interaction) {
    //TODO  skip late message updates, slow net fix?
    const db = new StormDB(Engine);
    const options = db.get('options').value();

    try {
        let message;
        //checking API call interval
        if (!getLeaderId()) {
            if (updateIntervalId)
                clearInterval(updateIntervalId)
            updateOnInterval = false;
        }

        lastMessage ??= interaction.message;
        let data = await getUserData(interaction);
        if (!data) {
            state = null;
            throw "data object is null"
        }
        // update new users
        let newUsers = 0;
        if (state)
            newUsers = data.length - state.length;
        for (let i = 1; i < data.length; i++) {
            if (i > data.length - newUsers)
                data[i].new = true;
            else
                data[i].new = false;
        }
        // update queue only on track change
        if (state?.[0]?.track?.id != data[0]?.track.id) {
            if (!arguments[1] && data[0]) {
                data[0].queue = await getQueue(data[0], 10);
                if (!db.get('options.sync_context').value())
                    updateQueue(data);
                queue = data[0].queue;
            }
        }
        if (data[0] && !data[0].queue)
            data[0].queue = queue;

        console.log('LISTENING:\n', data.map(user => {
            return {
                id: user.userId,
                is_playing: user.is_playing,
                name: user.name,
                new: user.new
            }
        }));

        //interaction.client.state ??= data;
        if (data.length > 1) {
            for (let i = 1; i < data.length; i++) {
                data[i].skipping = state?.[i]?.skipping || false;
            }
            syncPlayback(data);
            for (let i = 1; i < data.length; i++) {
                console.log("SKIP ON?", data[i].name, data[i].skipping);
                data[i].skipping =
                    (data[i].track.id == data[0].track.id) ? false : data[i].skipping;
            }
        }
        state = data;
        //timeout to update on estimated track end
        try {
            if (!data[0]) throw "data object is null"
            const delay = data[0].duration - data[0].progress + 3000;
            if (!timeoutId || timeoutDelay > delay) {
                console.log(`setting song duration timeout of ${
                    dayjs.duration(delay).format('m:ss')
                }`);
                timeoutDelay = delay;
                if (timeoutId)
                    clearTimeout(timeoutId);
                timeoutId = setTimeout(onTrackChange, delay, interaction);
            }
        } catch (error) {
            console.log('in updateRemote().timeout', error);
        }
    } catch (error) {
        console.error('In updateRemote(): ', error);
    }
}

async function remote (interaction) {
    const db = new StormDB(Engine);

    await updateRemote(interaction);
    if (updateOnInterval) {
        if (updateIntervalId)
            clearInterval(updateIntervalId)
        const delay = db.get('options.updaterate').value() || 5000;
        console.log(`setting an update interval of ${delay} milliseconds`);
        updateIntervalId = setInterval(updateRemote, delay, interaction);
    }
    refreshRemote(interaction);
    if (refreshOnInterval) {
        if (refreshIntervalId)
            clearInterval(refreshIntervalId)
        const delay = db.get('options.refreshrate').value() || 5000;
        console.log(`setting a refresh interval of ${delay} milliseconds`);
        refreshIntervalId = setInterval(refreshRemote, delay, interaction);
    }
}

async function onTrackChange (interaction) {
    console.log("track change update");
    timeoutId = 0;
    timeoutDelay = 0;
    await updateRemote(interaction);
}

function isListener (userId) {
    return listening.includes(userId);
}

function addListener (interaction) {
    console.log('Adding listener ' + interaction.user.tag);
    listening.push(interaction.user.id);
    console.log(listening);
    updateOnInterval = true;
    refreshOnInterval = true;
}

function removeListener (userId) {
    console.log('Removing listener ', userId);
    listening = listening.filter(user => user != userId);
    console.log(listening);
    if (!getLeaderId() && (updateIntervalId || refreshIntervalId)) {
        console.log("clearing intervals");
        clearInterval(updateIntervalId);
        clearInterval(refreshIntervalId);
        updateIntervalId = refreshIntervalId = 0;
        updateOnInterval = refreshOnInterval = false;
    }
}

module.exports = {
    isListener,
    addListener,
    removeListener,
    postGuide,
    batchExecute,
    execute,
    getToken,
    apiError,
    validateResponse,
    getPlayingTrack,
    isSaved,
    getLeaderId,
    getListening,
    remote
};
