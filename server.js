require('dotenv').config();
const crypto = require('crypto');
const cmd = require('node-cmd');
const logger = require('./logger.js');
const fastify = require('fastify')({ logger: false });
const path = require('path');

// Declare a route
fastify.register(require('fastify-static'), {
    root: path.join(__dirname, './public'),
    prefix: '/'
});

fastify.get('/guide', function (req, reply) {
    logger.info('guide opened');
    return reply.sendFile('index.html');
});

//update glitch with github webhooks
fastify.post('/git', function (req, reply) {
  logger.info('/git post event');
  if (process.env.ENV != 'glitch') return;
  let hmac = crypto.createHmac('sha1', process.env.GIT_SECRET);
  let sig = `sha1=${hmac.update(JSON.stringify(req.body)).digest('hex')}`;

  if (req.headers['x-github-event'] == 'push' && sig === req.headers['x-hub-signature']) {
    cmd.runSync('chmod 777 ./glitch.sh');
    cmd.runSync('./glitch.sh', (err, data) => {
      if (data)
        logger.info(data);
      if (err)
        logger.error(err);
    });
    cmd.run('sleep 2 && refresh');
  }
  return reply.sendStatus(200);
});

const startServer = async () => {
  try {
    await fastify.listen(process.env.PORT, '0.0.0.0')
  } catch (err) {
    logger.error("fastify error", err)
    fastify.log.error(err)
    process.exit(1)
  }
};

module.exports = { startServer };
