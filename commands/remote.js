const logger = require("../logger.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const methods = require("../methods.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remote")
    .setDescription("Start a party and control playback."),

  async execute(interaction) {
    try {
      logger.debug(`interaction ${interaction.id} beggining deferral`);
      await interaction.deferReply();
      logger.debug(`interaction ${interaction.id} has been deferred`);
      let data;
      if (methods.getLeaderId()) {
        data = await methods.getUserData(interaction);
        logger.debug("userData recieved");
        if (data?.length) data[0].queue = await methods.getQueue(data[0], 10);
      }
      const message = await methods.remoteMessage(data);
      logger.debug("remoteMessage recieved");
      const lastMessage = methods.getLastMessage();
      if (lastMessage) lastMessage.edit(methods.blankMessage());
      const newMessage = await interaction.editReply(message);
      methods.setLastMessage(newMessage);
    } catch (error) {
      logger.error(error);
      await interaction.editReply(methods.failedMessage());
    }
  },
};
