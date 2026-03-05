/**
 * Borra todos los archivos de la carpeta podcast_episodes.
 * Uso: node src/scripts/clean-episodes.js
 * o: npm run clean-episodes
 */
require('dotenv').config();
const { cleanEpisodesFolder } = require('../podcasts/downloader');
const logger = require('../logger');

cleanEpisodesFolder();
logger.info('Carpeta podcast_episodes vaciada.');
