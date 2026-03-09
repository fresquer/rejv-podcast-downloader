/**
 * Sincronización con AzuraCast:
 * - Si env.sftpHost + sftpRemotePath → subida por SFTP.
 * - Si env.azuracastLocalMediaPath → copia MP3 a disco (mismo servidor).
 * - Si no → API (listar, borrar, subir por multipart).
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const SftpClient = require('ssh2-sftp-client');
const { env, getApiBase } = require('../config');
const logger = require('../logger');

function createApiClient() {
    return axios.create({
        baseURL: getApiBase(),
        headers: {
            'Authorization': `Bearer ${env.azuracastApiKey}`,
            'X-API-Key': env.azuracastApiKey,
        },
    });
}

async function resolveStationId() {
    if (env.azuracastStationId) {
        return String(env.azuracastStationId);
    }
    const { data } = await axios.get(`${getApiBase()}/stations`);
    if (!data || data.length === 0) {
        throw new Error('No se encontraron estaciones en AzuraCast');
    }
    const station = data[0];
    const id = station.id ?? station.station_id;
    logger.info(`Usando estación: ${station.name || id} (ID: ${id})`);
    return String(id);
}

/**
 * Lista todos los archivos de la estación.
 * @param {string} stationId
 * @returns {Promise<Array>}
 */
async function listFiles(stationId) {
    const api = createApiClient();
    const { data } = await api.get(`/station/${stationId}/files`);
    return Array.isArray(data) ? data : [];
}

/**
 * Elimina un archivo por media_id.
 */
async function deleteFile(stationId, mediaId) {
    const api = createApiClient();
    await api.delete(`/station/${stationId}/file/${mediaId}`);
}

/**
 * Sube un archivo por multipart (evita 413: base64 aumenta ~33% el tamaño).
 * Si env.azuracastUploadPath está definido, se envía como campo "path" en el form.
 */
async function uploadFile(stationId, localFilePath, filename) {
    const api = createApiClient();
    const form = new FormData();
    form.append('file', fs.createReadStream(localFilePath), {
        filename,
        contentType: 'audio/mpeg',
    });
    if (env.azuracastUploadPath) {
        const destPath = env.azuracastUploadPath.replace(/\/$/, '') + '/' + filename;
        form.append('path', destPath);
    }
    await api.post(`/station/${stationId}/files/upload`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
    });
}

/**
 * Sincroniza copiando los MP3 a la carpeta local de medios (mismo servidor).
 * Incremental: solo borra archivos que ya no están en la lista y solo copia los nuevos o modificados.
 */
function syncMediaLocal(localDir, mp3Filenames) {
    const destDir = env.azuracastLocalMediaPath;
    if (!destDir) return false;

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        logger.info(`Carpeta de medios local creada: ${destDir}`);
    }

    const wantSet = new Set(mp3Filenames);
    const existing = fs.readdirSync(destDir).filter((n) => fs.statSync(path.join(destDir, n)).isFile());

    const toRemove = existing.filter((n) => !wantSet.has(n));
    const removedFiles = [];
    for (const name of toRemove) {
        fs.unlinkSync(path.join(destDir, name));
        removedFiles.push(name);
        logger.info(`Eliminado (local): ${name}`);
    }
    if (toRemove.length > 0) logger.info(`Eliminados ${toRemove.length} archivos obsoletos`);

    let copied = 0;
    const uploadedFiles = [];
    for (const filename of mp3Filenames) {
        const src = path.join(localDir, filename);
        const dest = path.join(destDir, filename);
        const needCopy = !fs.existsSync(dest) || fs.statSync(src).size !== fs.statSync(dest).size;
        if (needCopy) {
            fs.copyFileSync(src, dest);
            const fileSizeMB = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
            logger.info(`Copiado: ${filename} (${fileSizeMB} MB)`);
            uploadedFiles.push(filename);
            copied++;
        }
    }
    if (copied > 0) logger.info(`Sincronización local: ${copied} archivo(s) nuevo(s)/actualizado(s)`);
    else if (toRemove.length === 0) logger.info('Sincronización local: sin cambios.');
    return { method: 'local', uploaded: copied, removed: toRemove.length, uploadedFiles, removedFiles };
}

/**
 * Sincroniza subiendo los MP3 por SFTP al servidor AzuraCast.
 * Incremental: solo elimina en remoto los que ya no están en la lista y solo sube los nuevos.
 */
async function syncMediaSftp(localDir, mp3Filenames) {
    if (!env.sftpHost || !env.sftpRemotePath) return false;

    const sftp = new SftpClient();
    try {
        await sftp.connect({
            host: env.sftpHost,
            port: env.sftpPort,
            username: env.sftpUser,
            password: env.sftpPassword,
        });
        logger.info(`SFTP conectado a ${env.sftpHost}, ruta: ${env.sftpRemotePath}`);

        const remotePath = env.sftpRemotePath.replace(/\/$/, '');
        let list = [];
        try {
            list = await sftp.list(remotePath);
        } catch (e) {
            const msg = (e.message || '').toLowerCase();
            if (msg.includes('no such file') || msg.includes('no such directory') || msg.includes('not found')) {
                await sftp.mkdir(remotePath, true);
                logger.info(`Carpeta remota creada: ${remotePath}`);
            } else {
                throw e;
            }
        }
        const wantSet = new Set(mp3Filenames);
        const remoteFiles = (list || []).filter((f) => f.type === '-' && f.name);
        const toRemove = remoteFiles.filter((f) => !wantSet.has(f.name));
        const removedFiles = [];
        for (const f of toRemove) {
            const filePath = remotePath + '/' + f.name;
            await sftp.delete(filePath);
            removedFiles.push(f.name);
            logger.info(`Eliminado (SFTP): ${f.name}`);
        }
        if (toRemove.length > 0) logger.info(`Eliminados ${toRemove.length} archivos obsoletos en remoto`);

        let uploaded = 0;
        const uploadedFiles = [];
        for (const filename of mp3Filenames) {
            const localPath = path.join(localDir, filename);
            const remoteFile = remotePath + '/' + filename;
            const exists = remoteFiles.some((f) => f.name === filename);
            if (!exists) {
                await sftp.put(localPath, remoteFile);
                const fileSizeMB = (fs.statSync(localPath).size / (1024 * 1024)).toFixed(2);
                logger.info(`Subido (SFTP): ${filename} (${fileSizeMB} MB)`);
                uploadedFiles.push(filename);
                uploaded++;
            }
        }
        if (uploaded > 0) logger.info(`SFTP: ${uploaded} archivo(s) nuevo(s) subido(s)`);
        else if (toRemove.length === 0) logger.info('SFTP: sin cambios.');
        return { method: 'sftp', uploaded, removed: toRemove.length, uploadedFiles, removedFiles };
    } finally {
        await sftp.end();
    }
}

/**
 * Reinicia los servicios de la estación (AutoDJ, etc.) para que cargue los medios nuevos.
 * Solo se ejecuta si AZURACAST_API_KEY está definida.
 */
async function restartStationIfConfigured() {
    if (!env.azuracastApiKey) return;
    try {
        const stationId = await resolveStationId();
        const api = createApiClient();
        await api.post(`/station/${stationId}/restart`);
        logger.info('Estación reiniciada (servicios de retransmisión actualizados).');
    } catch (err) {
        logger.warn('No se pudo reiniciar la estación (¿API key con permiso?):', err.response?.data?.message || err.message);
    }
}

/**
 * Sincroniza con AzuraCast: borra todos los archivos actuales y sube los MP3 de la carpeta indicada.
 * Orden: SFTP (si config) → copia local (si config) → API.
 * Si hay API key, tras subir por SFTP o copia local se reinicia la estación para que cargue los cambios.
 * @param {string} localDir - Carpeta con los MP3 (ej. podcast_episodes)
 * @param {string[]} mp3Filenames - Lista de nombres de archivo .mp3
 */
async function syncMedia(localDir, mp3Filenames) {
    const sftpResult = await syncMediaSftp(localDir, mp3Filenames);
    if (sftpResult) {
        await restartStationIfConfigured();
        return sftpResult;
    }
    const localResult = syncMediaLocal(localDir, mp3Filenames);
    if (localResult) {
        await restartStationIfConfigured();
        return localResult;
    }

    if (!env.azuracastApiKey) {
        throw new Error('Configura AZURACAST_SFTP_*, AZURACAST_LOCAL_MEDIA_PATH o AZURACAST_API_KEY.');
    }

    const stationId = await resolveStationId();

    logger.info('Sincronización con AzuraCast (API, incremental)');

    const files = await listFiles(stationId);
    const wantSet = new Set(mp3Filenames);
    const serverByBasename = new Map();
    for (const file of files) {
        const name = path.basename(file.path || file.name || file.text || '');
        if (name) serverByBasename.set(name, file);
    }

    const toRemove = files.filter((f) => {
        const name = path.basename(f.path || f.name || f.text || '');
        return name && !wantSet.has(name);
    });
    const removedFiles = [];
    for (const file of toRemove) {
        const mediaId = file.id ?? file.media_id;
        if (mediaId == null) continue;
        const name = path.basename(file.path || file.text || String(mediaId));
        try {
            await deleteFile(stationId, mediaId);
            removedFiles.push(name);
            logger.info(`Eliminado: ${name}`);
        } catch (err) {
            logger.error(`Error eliminando ${mediaId}:`, err.response?.data?.message || err.message);
        }
    }
    if (toRemove.length > 0) logger.info(`Eliminados ${toRemove.length} archivos obsoletos`);

    const toUpload = mp3Filenames.filter((name) => !serverByBasename.has(name));
    let uploaded = 0;
    const uploadedFiles = [];
    for (let i = 0; i < toUpload.length; i++) {
        const filename = toUpload[i];
        const localPath = path.join(localDir, filename);
        const fileSizeMB = (fs.statSync(localPath).size / (1024 * 1024)).toFixed(2);
        try {
            await uploadFile(stationId, localPath, filename);
            logger.info(`[${i + 1}/${toUpload.length}] Subido: ${filename} (${fileSizeMB} MB)`);
            uploadedFiles.push(filename);
            uploaded++;
        } catch (err) {
            logger.error(`Error subiendo ${filename}:`, err.response?.data?.message || err.message);
        }
    }
    if (uploaded > 0) logger.info(`Subidos ${uploaded} archivo(s) nuevo(s)`);
    else if (toRemove.length === 0) logger.info('Sin cambios en AzuraCast.');
    await restartStationIfConfigured();
    return { method: 'api', uploaded, removed: toRemove.length, uploadedFiles, removedFiles };
}

module.exports = {
    resolveStationId,
    listFiles,
    deleteFile,
    uploadFile,
    syncMedia,
};
