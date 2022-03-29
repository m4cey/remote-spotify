const logger = require("../logger.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const methods = require("../methods.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remote")
    .setDescription("Start a party and control playback."),

  async execute(interaction) {
    let newMessage;
    try {
      logger.debug(`interaction ${interaction.id} beggining deferral`);
      newMessage = await interaction.deferReply({ fetchReply: true });
      logger.debug(newMessage);
      logger.debug(`interaction ${interaction.id} has been deferred`);
      let data;
      if (methods.getLeaderId()) {
        data = await methods.getUserData(interaction);
        if (data?.length) data[0].queue = await methods.getQueue(data[0], 10);
      }
      const message = await methods.remoteMessage(data);
      const lastMessage = methods.getLastMessage();
      if (lastMessage) lastMessage.edit(methods.blankMessage());
      await newMessage.edit(message);
      methods.setLastMessage(newMessage);
    } catch (error) {
      logger.error(error);
      if (newMessage) await newMessage.edit(methods.failedMessage());
      else await interaction.reply(methods.failedMessage());
    }
  },
};
