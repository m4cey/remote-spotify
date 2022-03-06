const fastify = require('fastify')({ logger: false });
const path = require('path');

// Declare a route
fastify.register(require('fastify-static'), {
    root: path.join(__dirname, './public'),
    prefix: '/'
});

fastify.get('/guide', function (req, reply) {
    return reply.sendFile('index.html');
})

const startServer = async () => {
  try {
    await fastify.listen(8080, '0.0.0.0')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
};

module.exports = { startServer };
