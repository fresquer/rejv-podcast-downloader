/**
 * Sincronización con AzuraCast:
 * - Si env.azuracastLocalMediaPath está definido → copia MP3 a disco (mismo servidor, sin HTTP).
 * - Si no → usa la API (listar, borrar, subir por multipart).
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
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
 * Evita HTTP y límites 413. La carpeta debe ser la de medios de la estación (o una subcarpeta).
 */
function syncMediaLocal(localDir, mp3Filenames) {
    const destDir = env.azuracastLocalMediaPath;
    if (!destDir) return false;

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        logger.info(`Carpeta de medios local creada: ${destDir}`);
    }

    const existing = fs.readdirSync(destDir);
    for (const name of existing) {
        const full = path.join(destDir, name);
        if (fs.statSync(full).isFile()) {
            fs.unlinkSync(full);
        }
    }
    if (existing.length > 0) {
        logger.info(`Limpiada carpeta local (${existing.length} archivos anteriores)`);
    }

    if (mp3Filenames.length === 0) {
        logger.info('No hay episodios para copiar.');
        return true;
    }

    logger.info(`Copiando ${mp3Filenames.length} episodios a ${destDir}...`);
    for (let i = 0; i < mp3Filenames.length; i++) {
        const filename = mp3Filenames[i];
        const src = path.join(localDir, filename);
        const dest = path.join(destDir, filename);
        fs.copyFileSync(src, dest);
        const fileSizeMB = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
        logger.info(`[${i + 1}/${mp3Filenames.length}] Copiado: ${filename} (${fileSizeMB} MB)`);
    }
    logger.info(`Sincronización local completada: ${mp3Filenames.length} episodios`);
    return true;
}

/**
 * Sincroniza con AzuraCast: borra todos los archivos actuales y sube los MP3 de la carpeta indicada.
 * Si AZURACAST_LOCAL_MEDIA_PATH está definido, copia en disco (mismo servidor) y no usa la API.
 * @param {string} localDir - Carpeta con los MP3 (ej. podcast_episodes)
 * @param {string[]} mp3Filenames - Lista de nombres de archivo .mp3
 */
async function syncMedia(localDir, mp3Filenames) {
    if (syncMediaLocal(localDir, mp3Filenames)) {
        return;
    }

    if (!env.azuracastApiKey) {
        throw new Error('AZURACAST_API_KEY es obligatorio (o define AZURACAST_LOCAL_MEDIA_PATH para copia local).');
    }

    const stationId = await resolveStationId();
    const api = createApiClient();

    logger.info('Sincronización con AzuraCast (API)');

    const files = await listFiles(stationId);

    if (files.length > 0) {
        logger.info(`Eliminando ${files.length} archivos actuales en AzuraCast...`);
        for (const file of files) {
            const mediaId = file.id ?? file.media_id;
            if (mediaId == null) continue;
            try {
                await deleteFile(stationId, mediaId);
                logger.info(`Eliminado: ${file.path || file.text || mediaId}`);
            } catch (err) {
                logger.error(`Error eliminando ${mediaId}:`, err.response?.data?.message || err.message);
            }
        }
        logger.info('Archivos anteriores eliminados');
    } else {
        logger.info('No hay archivos previos que eliminar.');
    }

    if (mp3Filenames.length === 0) {
        logger.info('No hay episodios locales para subir.');
        return;
    }

    logger.info(`Subiendo ${mp3Filenames.length} episodios...`);

    for (let i = 0; i < mp3Filenames.length; i++) {
        const filename = mp3Filenames[i];
        const localPath = path.join(localDir, filename);
        const fileSizeMB = (fs.statSync(localPath).size / (1024 * 1024)).toFixed(2);

        try {
            await uploadFile(stationId, localPath, filename);
            logger.info(`[${i + 1}/${mp3Filenames.length}] Subido: ${filename} (${fileSizeMB} MB)`);
        } catch (err) {
            logger.error(`Error subiendo ${filename}:`, err.response?.data?.message || err.message);
        }
    }

    logger.info(`Sincronización completada: ${mp3Filenames.length} episodios en AzuraCast`);
}

module.exports = {
    resolveStationId,
    listFiles,
    deleteFile,
    uploadFile,
    syncMedia,
};
