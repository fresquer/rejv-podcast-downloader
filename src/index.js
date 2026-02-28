/**
 * Entrada principal: descarga últimos episodios de cada podcast y sincroniza con AzuraCast.
 * Sync por copia local (AZURACAST_LOCAL_MEDIA_PATH) o por API (AZURACAST_API_KEY).
 */
require('dotenv').config();
const { loadShows } = require('./config');
const { fetchAndDownloadLatest, getLocalMp3Files, downloadDir } = require('./podcasts/downloader');
const { syncMedia } = require('./azuracast/client');
const { sendDiscordMessage } = require('./notify/discord');
const logger = require('./logger');

function formatDate() {
    return new Date().toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
}

async function run() {
    logger.info('=== Iniciando sincronización ===');

    const podcasts = loadShows();
    await fetchAndDownloadLatest(podcasts);

    const mp3Files = getLocalMp3Files();
    await syncMedia(downloadDir, mp3Files);

    logger.info('=== Sincronización finalizada ===');
    await sendDiscordMessage(`✅ **Rejv Sync OK** – ${formatDate()}`);
}

run().catch(async (err) => {
    logger.error('Error fatal:', err.message);
    try {
        await sendDiscordMessage(`❌ **Rejv Sync ERROR** – ${formatDate()}\n\`\`\`${err.message}\`\`\``);
    } finally {
        process.exit(1);
    }
});
