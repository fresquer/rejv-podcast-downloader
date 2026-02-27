const axios = require('axios');
const xml2js = require('xml2js');
const logger = require('../logger');

/**
 * Parsea el feed RSS de un podcast y devuelve la lista de episodios.
 * @param {Object} podcast - { nombre, key, rss }
 * @returns {Promise<Array>} Episodios con title, link, pubDate, mp3, podcast, episodeNumber, episodeDate, etc.
 */
async function fetchEpisodes(podcast) {
    try {
        const response = await axios.get(podcast.rss);
        const parsed = await xml2js.parseStringPromise(response.data);
        const items = parsed.rss?.channel?.[0]?.item ?? [];

        return items.map((item) => {
            const episodeNumber = item['itunes:episode']?.[0] ?? 'unknown';
            const pubDate = item.pubDate?.[0] ? new Date(item.pubDate[0]) : new Date();
            const episodeDate = pubDate.getFullYear().toString();

            return {
                title: item.title?.[0] ?? '',
                link: item.link?.[0] ?? '',
                pubDate,
                description: item.description?.[0] ?? '',
                mp3: item.enclosure?.[0]?.$?.url ?? '',
                image: item['itunes:image']?.[0]?.$?.href ?? '',
                podcast: podcast.nombre,
                episodeNumber,
                episodeDate,
            };
        });
    } catch (err) {
        logger.error(`Error obteniendo feed de ${podcast.nombre}:`, err.message);
        return [];
    }
}

module.exports = { fetchEpisodes };
