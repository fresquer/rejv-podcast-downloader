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

function formatDuration(ms) {
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec} s`;
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${min} min ${s} s` : `${min} min`;
}

async function run() {
    const startTime = Date.now();
    global.__syncStartTime = startTime;
    logger.info('=== Iniciando sincronización ===');

    const podcasts = await loadShows();
    await sendDiscordMessage(`🟢 **Rejv Sync** – Iniciando – ${formatDate()} – ${podcasts.length} podcasts`);

    const { stats: downloadStats } = await fetchAndDownloadLatest(podcasts);

    const mp3Files = getLocalMp3Files();
    const syncStats = await syncMedia(downloadDir, mp3Files);

    const duration = formatDuration(Date.now() - startTime);
    const lines = [`✅ **Rejv Sync OK** – ${formatDate()} · ⏱ ${duration}`];

    if (downloadStats.downloadedEpisodes.length > 0) {
        lines.push(`\n**Nuevos episodios (${downloadStats.newDownloadsOk}/${downloadStats.podcastsChecked}):**`);
        for (const ep of downloadStats.downloadedEpisodes) {
            lines.push(`• ${ep.show} – ${ep.title}`);
        }
    } else {
        lines.push(`\n**Sin cambios:** todos los ${downloadStats.podcastsChecked} podcasts al día`);
    }

    if (downloadStats.failedEpisodes.length > 0) {
        lines.push(`\n**Fallos (${downloadStats.failedEpisodes.length}):**`);
        for (const ep of downloadStats.failedEpisodes) {
            lines.push(`• ❌ ${ep.show} – ${ep.title}`);
        }
    }

    if (syncStats.removedFiles && syncStats.removedFiles.length > 0) {
        lines.push(`\n**Eliminados de AzuraCast (${syncStats.removedFiles.length}):**`);
        for (const f of syncStats.removedFiles) {
            lines.push(`• ${f}`);
        }
    }

    lines.push(`\n**Sync ${syncStats.method.toUpperCase()}:** ${syncStats.uploaded} subidos · ${syncStats.removed} eliminados`);

    logger.info('=== Sincronización finalizada ===');
    await sendDiscordMessage(lines.join('\n'));
}

run().catch(async (err) => {
    logger.error('Error fatal:', err.message);
    const startTime = global.__syncStartTime;
    const duration = typeof startTime === 'number' ? ` (tras ${formatDuration(Date.now() - startTime)})` : '';
    try {
        await sendDiscordMessage(`❌ **Rejv Sync ERROR** – ${formatDate()}${duration}\n\`\`\`${err.message}\`\`\``);
    } finally {
        process.exit(1);
    }
});
