const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const env = {
    azuracastUrl: (process.env.AZURACAST_URL || 'https://live.radioespaijove.es').replace(/\/$/, ''),
    azuracastApiKey: process.env.AZURACAST_API_KEY,
    azuracastStationId: process.env.AZURACAST_STATION_ID,
    azuracastUploadPath: (process.env.AZURACAST_UPLOAD_PATH || '').trim(),
    discordWebhookUrl: (process.env.DISCORD_WEBHOOK_URL || '').trim(),
    downloadDirectory: path.join(PROJECT_ROOT, 'podcast_episodes'),
    showsDbPath: path.join(PROJECT_ROOT, 'shows_db.json'),
    episodesJsonPath: path.join(PROJECT_ROOT, 'episodes.json'),
};

function loadShows() {
    const raw = fs.readFileSync(env.showsDbPath, 'utf8');
    return JSON.parse(raw);
}

function getApiBase() {
    return `${env.azuracastUrl}/api`;
}

module.exports = {
    env,
    loadShows,
    getApiBase,
    PROJECT_ROOT,
};
