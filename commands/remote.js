const logger = require("../logger.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const methods = require("../methods.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remote")
    .setDescription("Start a party and control playback."),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      let data;
      if (methods.getLeaderId()) {
        data = await methods.getUserData(interaction);
        if (data?.length) data[0].queue = await methods.getQueue(data[0], 10);
      }
      const message = await methods.remoteMessage(data);
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
