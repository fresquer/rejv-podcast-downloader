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

/** Archivos .mp3 en downloadDir cuyo nombre empieza por el prefijo del programa (para sustituir episodio viejo por el nuevo). */
function getExistingFilesForShow(showPrefix) {
    if (!fs.existsSync(downloadDir)) return [];
    const prefix = showPrefix + ' - ';
    return fs.readdirSync(downloadDir).filter((f) => f.endsWith('.mp3') && f.startsWith(prefix));
}

function sanitizeFileName(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '_');
}

async function downloadAndTagEpisode(episodeUrl, fileName, metadata) {
    try {
        const response = await axios.get(episodeUrl, {
            responseType: 'arraybuffer',
            timeout: env.downloadTimeoutMs,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
        });
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
        return true;
    } catch (err) {
        logger.error(`Failed to download or tag: ${fileName}`, err.message);
        return false;
    }
}

/**
 * Descarga solo los episodios nuevos. Fase 1: comprobar todos los feeds sin delay y armar la lista de MP3.
 * Fase 2: descargar solo los que falten, con delay entre cada descarga.
 * Se mantiene siempre 1 archivo por podcast (el último).
 * @param {Array} podcasts - Lista de podcasts (desde config.loadShows())
 * @returns {Promise<{ episodes: Array, downloadedDir: string, stats: { podcastsChecked: number, totalEpisodesInFeeds: number, newDownloadsAttempted: number, newDownloadsOk: number, newDownloadsFailed: number } }>}
 */
async function fetchAndDownloadLatest(podcasts) {
    ensureDownloadDir();

    // Fase 1: comprobar todos los feeds sin delay y construir lista de qué descargar
    let allEpisodes = [];
    const toDownload = [];

    for (const podcast of podcasts) {
        logger.info(`Comprobando: ${podcast.nombre}`);
        const episodes = await fetchEpisodes(podcast);
        episodes.sort((a, b) => b.pubDate - a.pubDate);
        allEpisodes = allEpisodes.concat(episodes);

        if (episodes.length > 0 && episodes[0].mp3) {
            const latest = episodes[0];
            const programName = podcast.nombre;
            const showPrefix = sanitizeFileName(programName);
            const fileName = `${showPrefix} - ${latest.episodeNumber} - ${sanitizeFileName(latest.title)}`;

            if (isEpisodeDownloaded(fileName)) {
                logger.info(`Ya existe (omitido): ${fileName}`);
                continue;
            }

            toDownload.push({
                mp3: latest.mp3,
                fileName,
                showPrefix,
                metadata: {
                    title: latest.title,
                    artist: programName,
                    album: programName,
                    trackNumber: latest.episodeNumber,
                    genre: 'Podcast',
                    year: latest.episodeDate,
                },
            });
        }
    }

    allEpisodes.sort((a, b) => b.pubDate - a.pubDate);
    fs.writeFileSync(env.episodesJsonPath, JSON.stringify(allEpisodes, null, 2));
    logger.info('Episodios guardados en episodes.json');
    logger.info(`Total de episodios: ${allEpisodes.length}`);

    let newDownloadsOk = 0;
    let newDownloadsFailed = 0;
    if (toDownload.length > 0) {
        logger.info(`Descargando ${toDownload.length} episodio(s) nuevo(s)...`);
        for (let i = 0; i < toDownload.length; i++) {
            if (i > 0 && env.downloadDelayMs > 0) {
                await new Promise((r) => setTimeout(r, env.downloadDelayMs));
            }
            const item = toDownload[i];
            const existingForShow = getExistingFilesForShow(item.showPrefix);
            for (const oldFile of existingForShow) {
                const fullPath = path.join(downloadDir, oldFile);
                fs.unlinkSync(fullPath);
                logger.info(`Eliminado episodio anterior: ${oldFile}`);
            }
            const ok = await downloadAndTagEpisode(item.mp3, item.fileName, item.metadata);
            if (ok) newDownloadsOk++;
            else newDownloadsFailed++;
        }
    }

    const stats = {
        podcastsChecked: podcasts.length,
        totalEpisodesInFeeds: allEpisodes.length,
        newDownloadsAttempted: toDownload.length,
        newDownloadsOk,
        newDownloadsFailed,
    };
    return { episodes: allEpisodes, downloadedDir: downloadDir, stats };
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
