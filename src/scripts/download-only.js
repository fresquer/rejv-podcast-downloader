/**
 * Solo descarga los últimos episodios (sin subir a AzuraCast).
 * Uso: node src/scripts/download-only.js
 */
require('dotenv').config();
const { loadShows } = require('../config');
const { fetchAndDownloadLatest } = require('../podcasts/downloader');
const logger = require('../logger');

async function run() {
    const podcasts = loadShows();
    await fetchAndDownloadLatest(podcasts);
    logger.info('Descarga finalizada.');
}

run().catch((err) => {
    logger.error('Error:', err.message);
    process.exit(1);
});
