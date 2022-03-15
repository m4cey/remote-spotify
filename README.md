# Remote Spotify
Remote control your Spotify app playback, create playlists, fetch lyrics of your playing songs, and sync your listenening with friends.

This bot uses cookies to authenticate to the Spotify Web API so it does not require a premium Spotify account.

**⚠️It uses cookies, you have been warned! use at your own discretion⚠️**

## Environment variables

To properly host this bot, you must configure the following environment variables first.

`clientId:`

Your bot's ID.

`token:`

The bot's secret access token.

`guildId:`

The ID of the server you want to run this bot on.

`key:`

Database encryption key.

`domain:`

The domain of your app, eg: https://your-app-name.glitch.me

`genius_id:`

A Genius API application ID, Required for fetching lyrics. Create one at https://genius.com/api-clients

`genius_key:`

The access token generated for your Genius application.

`GIT_SECRET:`

If you choose to fork this repo and host it on glitch.me yourself, you may use this to set up a github webhook to pull changes automatically. Send the post request to https://your-app-name.glitch.me/git

`LOG_LEVEL:`

The log level, possible values are [error, debug, info]

`LOCAL:`

If set to 0, the bot will save a snapshot of the database on an SFTP server and update it on every change, as well as fetch the it whenever it is lost. useful for hosting on services like heroku where file changes don't persist.

The following options only apply if `LOCAL=0`

`SFTP_HOST:`

The SFTP server to use.

`SFTP_USER:`

The SFTP server's username.

`SFTP_PORT:`

The SFTP server's port.

`SFTP_PASSWORD:`

The SFTP server's password.
