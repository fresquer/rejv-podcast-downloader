const fs = require('fs');
const path = require('path');
const axios = require('axios');
const id3 = require('node-id3');
const { env } = require('../config');
const logger = require('../logger');
const { fetchEpisodes } = require('./rss');

const downloadDir = env.downloadDirectory;

function ensureDownloadDir() {
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
    }
}

function cleanEpisodesFolder() {
    ensureDownloadDir();
    const files = fs.readdirSync(downloadDir);
    for (const file of files) {
        fs.unlinkSync(path.join(downloadDir, file));
    }
    logger.info(`Carpeta ${path.basename(downloadDir)} limpiada`);
}

function isEpisodeDownloaded(fileName) {
    return fs.existsSync(path.join(downloadDir, `${fileName}.mp3`));
}

function sanitizeFileName(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '_');
}

async function downloadAndTagEpisode(episodeUrl, fileName, metadata) {
    try {
        const response = await axios.get(episodeUrl, { responseType: 'arraybuffer' });
        const filePath = path.join(downloadDir, `${fileName}.mp3`);
        fs.writeFileSync(filePath, response.data);
        logger.info(`Downloaded: ${fileName}`);

        id3.write(
            {
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                trackNumber: metadata.trackNumber,
                genre: metadata.genre,
                year: metadata.year,
            },
            filePath
        );
        logger.info(`Tagged: ${fileName}`);
    } catch (err) {
        logger.error(`Failed to download or tag: ${fileName}`, err.message);
    }
}

/**
 * Ejecuta el flujo completo: limpiar carpeta, obtener episodios de todos los podcasts,
 * descargar el más reciente de cada uno, guardar episodes.json.
 * @param {Array} podcasts - Lista de podcasts (desde config.loadShows())
 * @returns {Promise<{ episodes: Array, downloadedDir: string }>}
 */
async function fetchAndDownloadLatest(podcasts) {
    ensureDownloadDir();
    cleanEpisodesFolder();

    let allEpisodes = [];

    for (const podcast of podcasts) {
        logger.info(`Procesando: ${podcast.nombre}`);
        const episodes = await fetchEpisodes(podcast);
        episodes.sort((a, b) => b.pubDate - a.pubDate);

        allEpisodes = allEpisodes.concat(episodes);

        if (episodes.length > 0 && episodes[0].mp3) {
            const latest = episodes[0];
            const programName = podcast.nombre;
            const fileName = `${sanitizeFileName(programName)} - ${latest.episodeNumber} - ${sanitizeFileName(latest.title)}`;

            if (!isEpisodeDownloaded(fileName)) {
                await downloadAndTagEpisode(latest.mp3, fileName, {
                    title: latest.title,
                    artist: programName,
                    album: programName,
                    trackNumber: latest.episodeNumber,
                    genre: 'Podcast',
                    year: latest.episodeDate,
                });
            } else {
                logger.info(`Ya existe: ${fileName}`);
            }
        }
    }

    allEpisodes.sort((a, b) => b.pubDate - a.pubDate);

    fs.writeFileSync(
        env.episodesJsonPath,
        JSON.stringify(allEpisodes, null, 2)
    );
    logger.info('Episodios guardados en episodes.json');
    logger.info(`Total de episodios: ${allEpisodes.length}`);

    return { episodes: allEpisodes, downloadedDir: downloadDir };
}

function getLocalMp3Files() {
    if (!fs.existsSync(downloadDir)) return [];
    return fs.readdirSync(downloadDir).filter((f) => f.endsWith('.mp3'));
}

module.exports = {
    fetchAndDownloadLatest,
    getLocalMp3Files,
    cleanEpisodesFolder,
    downloadDir,
};
