require('dotenv').config();
const fs = require('node:fs');
const { Client, Collection, Intents } = require('discord.js');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// Dynamic command and event handling
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
}

for (const file of eventFiles) {
	const event = require(`./events/${file}`);
	if (event.once) {
		client.once(event.name, async (...args) => await event.execute(...args));
	} else {
		client.on(event.name, async (...args) => await event.execute(...args));
	}
}

// Login to Discord with your client's token
client.login(process.env.TOKEN);
