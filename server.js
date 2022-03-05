const fastify = require('fastify')({logger: false});
const methods = require('./methods.js');

fastify.get('/callback', async (request, reply) => {
	if (!request.query || request.query.error)
		console.log('query failed! reason: ', request.query.error);
	else
		methods.setTokens(request.query);
	return;
});

const startServer = async () => {
	try {
		await fastify.listen(27079, '0.0.0.0' );
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
}

module.exports = { startServer };
