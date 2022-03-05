const fastify = require('fastify')({logger: false});

fastify.get('/callback', async (request, reply) => {
	console.log('query:', request.query);
	console.log('params:', request.params);
	reply.send({ query: request.query });
	return(reply);
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
