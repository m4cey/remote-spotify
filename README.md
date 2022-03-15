# Environment variables

To properly host this bot, you must configure the following environment variables first.

`clientId:`

Your bot's ID
`token:`

he bot's secret
`guildId:`

he ID of the server you want to run this bot on
`key:`

atabase encryption key
`domain:`

he domain of your app, eg: https://your-app-name.glitch.me
`genius_id:`

Genius API application's key. create one at https://genius.com/api-clients
`genius_key:`

he access token generated for your Genius application
`LOCAL:`

f set to 0, the bot will save a snapshot of the database to an SFTP server and
update it on every change. as well as fetch the it whenever it is lost. useful for hosting
on services like heroku where file changes don't persist.
`SFTP_HOST:`

he SFTP server to use, if LOCAL=0.
`SFTP_USER:`

he SFTP server's username.
`SFTP_PORT:`

he SFTP server's port.
`SFTP_PASSWORD:`

he SFTP server's password.
`GIT_SECRET:`

If you chose to fork this repo and host it on glitch.me yourself, you may use
this to set up a github webhook to pull changes automatically. Send the post request to your-app-name.glitch.me/git

`LOG_LEVEL:`
The log level, possible values are [error, debug, info]
