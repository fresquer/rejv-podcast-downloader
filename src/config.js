const path = require('path');
const axios = require('axios');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const SHOWS_API_URL = 'https://radioespaijove.es/api/shows.json';

const env = {
    azuracastUrl: (process.env.AZURACAST_URL || 'https://live.radioespaijove.es').replace(/\/$/, ''),
    azuracastApiKey: process.env.AZURACAST_API_KEY,
    azuracastStationId: process.env.AZURACAST_STATION_ID,
    azuracastUploadPath: (process.env.AZURACAST_UPLOAD_PATH || '').trim(),
    /** Ruta en disco de la carpeta de medios (mismo servidor). Si se define, se copian los MP3 aquí en lugar de subir por API (evita 413). */
    azuracastLocalMediaPath: (process.env.AZURACAST_LOCAL_MEDIA_PATH || '').trim(),
    /** SFTP: subida a AzuraCast por SFTP (evita 413, no requiere mismo servidor). */
    sftpHost: (process.env.AZURACAST_SFTP_HOST || '').trim(),
    sftpPort: parseInt(process.env.AZURACAST_SFTP_PORT || '22', 10),
    sftpUser: (process.env.AZURACAST_SFTP_USER || '').trim(),
    sftpPassword: (process.env.AZURACAST_SFTP_PASSWORD || '').trim(),
    sftpRemotePath: (process.env.AZURACAST_SFTP_REMOTE_PATH || '').trim(),
    discordWebhookUrl: (process.env.DISCORD_WEBHOOK_URL || '').trim(),
    /** Pausa en ms entre cada descarga de MP3 (evita saturar VPS y servidor de origen). Por defecto 3s para VPS. Poner 0 para ejecución rápida en local. */
    downloadDelayMs: parseInt(process.env.DOWNLOAD_DELAY_MS || '3000', 10),
    /** Pausa en ms entre cada petición de feed RSS (evita saturar en la fase de listado). Por defecto 500ms. */
    rssFetchDelayMs: parseInt(process.env.RSS_FETCH_DELAY_MS || '500', 10),
    /** Timeout en ms por descarga de MP3 (evita colgarse si el servidor no responde). */
    downloadTimeoutMs: parseInt(process.env.DOWNLOAD_TIMEOUT_MS || '120000', 10),
    downloadDirectory: path.join(PROJECT_ROOT, 'podcast_episodes'),
    episodesJsonPath: path.join(PROJECT_ROOT, 'episodes.json'),
};

/**
 * Obtiene la lista de shows desde la API. Solo devuelve los que tienen RSS.
 * @returns {Promise<Array<{ nombre: string, key: string, rss: string }>>}
 */
async function loadShows() {
    const { data } = await axios.get(SHOWS_API_URL, { timeout: 15000 });
    if (!Array.isArray(data)) return [];
    return data.filter((show) => !show.desactivado && show.rss && String(show.rss).trim() !== '');
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
