/**
 * Test rápido del flujo completo: 1 podcast, descarga + sync (local o API).
 *
 * Uso: npm run test-flow   o   node src/scripts/test-full-flow.js
 *
 * Variables de entorno (.env):
 *   AZURACAST_LOCAL_MEDIA_PATH  → copia a disco (mismo servidor).
 *   AZURACAST_API_KEY           → subida por API (si no usas LOCAL_MEDIA_PATH).
 *   DRY_RUN=1                   → solo descarga, no sync ni Discord.
 */
require('dotenv').config();

const { loadShows } = require('../config');
const { fetchAndDownloadLatest, getLocalMp3Files, downloadDir } = require('../podcasts/downloader');
const { syncMedia } = require('../azuracast/client');
const { sendDiscordMessage } = require('../notify/discord');
const logger = require('../logger');

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

function formatDate() {
    return new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

async function run() {
    logger.info('=== Test flujo completo (1 podcast) ===');

    let podcasts = loadShows();
    if (podcasts.length === 0) {
        throw new Error('shows_db.json está vacío o no tiene podcasts.');
    }
    podcasts = podcasts.slice(0, 1);
    logger.info(`Usando 1 podcast: ${podcasts[0].nombre}`);

    await fetchAndDownloadLatest(podcasts);

    const mp3Files = getLocalMp3Files();
    if (mp3Files.length === 0) {
        logger.warn('No se descargó ningún MP3 (puede que el feed no tenga episodios con enclosure).');
    } else {
        logger.info(`Descargados: ${mp3Files.length} archivo(s) en ${downloadDir}`);
    }

    if (DRY_RUN) {
        logger.info('DRY_RUN=1 → No se sube a AzuraCast ni se notifica a Discord.');
        logger.info('=== Test OK (solo descarga) ===');
        return;
    }

    const hasApiKey = !!process.env.AZURACAST_API_KEY;
    const hasLocalPath = !!process.env.AZURACAST_LOCAL_MEDIA_PATH;
    if (!hasApiKey && !hasLocalPath) {
        logger.warn('Ni AZURACAST_API_KEY ni AZURACAST_LOCAL_MEDIA_PATH definidos → No se sincroniza.');
        logger.info('=== Test OK (descarga completada) ===');
        await sendDiscordMessage(`🧪 **Rejv test** – Solo descarga OK – ${formatDate()}`);
        return;
    }

    await syncMedia(downloadDir, mp3Files);
    logger.info('=== Test flujo completo OK ===');
    await sendDiscordMessage(`✅ **Rejv test OK** – ${formatDate()}`);
}

run().catch(async (err) => {
    logger.error('Error:', err.message);
    try {
        await sendDiscordMessage(`❌ **Rejv test ERROR** – ${formatDate()}\n\`\`\`${err.message}\`\`\``);
    } finally {
        process.exit(1);
    }
});
