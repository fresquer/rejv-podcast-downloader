const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');

const podcastJsonFile = 'shows_db.json';
const podcasts = JSON.parse(fs.readFileSync(podcastJsonFile, 'utf8'));

async function fetchEpisodes(podcast) {
    try {
        const response = await axios.get(podcast.rss);
        const parsedData = await xml2js.parseStringPromise(response.data);
        const episodes = parsedData.rss.channel[0].item.map(item => ({
            title: item.title[0],
            link: item.link[0],
            pubDate: new Date(item.pubDate[0]),
            description: item.description ? item.description[0] : '',
            mp3: item.enclosure ? item.enclosure[0].$.url : '',
            image: item["itunes:image"] ? item["itunes:image"][0].$.href : '',
            podcast: podcast.nombre
        }));
        return episodes;
    } catch (error) {
        console.error(`Error obteniendo feed de ${podcast.nombre}:`, error.message);
        return [];
    }
}

async function fetchAllEpisodes() {
    let allEpisodes = [];
    for (const podcast of podcasts) {
        const episodes = await fetchEpisodes(podcast);
        allEpisodes = allEpisodes.concat(episodes);
    }

    allEpisodes.sort((a, b) => b.pubDate - a.pubDate);

    fs.writeFileSync('episodes.json', JSON.stringify(allEpisodes, null, 2));
    console.log('Episodios guardados en episodes.json');
}

fetchAllEpisodes();