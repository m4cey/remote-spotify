const logger = require("../logger.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const StormDB = require("stormdb");
const { Engine } = require("../database.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("options")
    .setDescription("set options?")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("updaterate")
        .setDescription("the rate by which to check the API for changes")
        .addNumberOption((option) =>
          option
            .setName("float")
            .setDescription("in seconds, eg: 1, 2.5, etc")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delay")
        .setDescription("Seconds to wait between every retry")
        .addNumberOption((option) =>
          option
            .setName("float")
            .setDescription("in seconds, eg: 1, 2.5, etc")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("margin")
        .setDescription("the margin of error while syncing")
        .addNumberOption((option) =>
          option
            .setName("float")
            .setDescription("in seconds, eg: 1, 2.5, etc")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sync_cooldown")
        .setDescription("Cooldown in seconds before resyncing")
        .addNumberOption((option) =>
          option
            .setName("float")
            .setDescription("in seconds, eg: 1, 2.5, etc")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("followup")
        .setDescription(
          "Send a new remote control when there's other messages after it"
        )
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription("enable or disable follow up messages")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("threshold")
        .setDescription(
          "The number of messages to wait before sending a follow up"
        )
        .addIntegerOption((option) =>
          option
            .setName("number")
            .setDescription("a number, not a letter. a NUMBER")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("retries")
        .setDescription("Number of retries before disonnecting leader")
        .addIntegerOption((option) =>
          option
            .setName("number")
            .setDescription("a number, not a letter. a NUMBER")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const db = new StormDB(Engine);
    const option = interaction.options.getSubcommand();
    let embed = {};
    let value;
    switch (option) {
      case "updaterate":
      case "margin":
      case "delay":
      case "sync_cooldown":
        value = 1000 * interaction.options.getNumber("float");
        break;
      case "followup":
        value = interaction.options.getBoolean("enabled");
        break;
      case "threshold":
      case "retries":
        value = interaction.options.getInteger("number");
        break;
      default:
        embed = {
          title: "Nothing was set",
          description: "didn't want to anyways",
        };
    }
    if (value != null) {
      db.get("options").get(option).set(value).save();
      embed = { description: `${option} = ${value}` };
    }
    logger.debug(db.get("options").value());
    await interaction.reply({ embeds: [embed] });
  },
};
