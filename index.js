// Require the necessary discord.js classes
const fs = require('node:fs');
const { Client, Collection, Intents, MessageEmbed } = require('discord.js');
const { token } = require('./config.json');
const fastify = require('fastify')({
	logger: false,
	/*https: {
		key: fs.readFileSync('./key.pem'),
		cert: fs.readFileSync('./cert.pem')
	}*/
});
//const StormDB = require('stormdb');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// Dynamic command handling
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
}

// redirect_uri end point
fastify.get('/callback', async (request, reply) => {
	console.log('query:', request.query);
	console.log('params:', request.params);
	reply.send({ hello: 'world', query: request.query });
	return(reply);
});
fastify.get('/', async (request, reply) => {
	console.log('query:', request.query);
	console.log('params:', request.params);
	reply.send({ hello: 'world', query: request.query });
	return(reply);
});

const start = async () => {
	try {
		await fastify.listen(27079, '0.0.0.0' );
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
}
start();


// When the client and server are ready, run this code (only once)

client.once('ready', () => {
	console.log('Ready!');
});

// Read and reply to registered commands
client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand())	return;
	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error)
		await interaction.reply({ content: 'no work, sorry :(', ephemeral: true });
	}
});

// Login to Discord with your client's token
client.login(token);
