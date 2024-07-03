const RSSParser = require('rss-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const rssUrls = [
    'https://www.ivoox.com/feed_fg_f12357605_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f1843721_filtro_1.xml',
    'https://elpodcastparadormir.com/feed/podcast/el-podcast-para-dormir',
    'https://www.ivoox.com/feed_fg_f11130793_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f12266152_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f1976275_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f12193550_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f1191283_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f11734686_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f1620618_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f1881887_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f12340091_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f11902751_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f1617557_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f11544697_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f11721371_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f12260376_filtro_1.xml',
];

const downloadDirectory = 'exp/podcast_episodes';

if (!fs.existsSync(downloadDirectory)) {
    fs.mkdirSync(downloadDirectory);
}

function isEpisodeDownloaded(fileName) {
    const filePath = path.join(downloadDirectory, `${fileName}.mp3`);
    return fs.existsSync(filePath);
}

async function downloadPodcastEpisode(episodeUrl, fileName) {
    try {
        const response = await axios.get(episodeUrl, { responseType: 'arraybuffer' });
        const filePath = path.join(downloadDirectory, `${fileName}.mp3`);
        fs.writeFileSync(filePath, response.data);
        console.log(`Downloaded: ${fileName}`);
    } catch (error) {
        console.error(`Failed to download: ${fileName}`, error);
    }
}

async function fetchAndDownloadLatestEpisodes() {
    const parser = new RSSParser();

    for (const url of rssUrls) {
        try {
            const feed = await parser.parseURL(url);
            if (feed.items.length > 0) {
                const latestEpisodes = feed.items.slice(0, 3); // Get the 3 latest episodes
                for (const episode of latestEpisodes) {
                    const programName = feed.title;
                    const episodeTitle = episode.title;
                    const episodeUrl = episode.enclosure.url;
                    const episodeNumber = episode.itunes && episode.itunes.episode ? episode.itunes.episode : 'unknown';

                    const fileName = `${programName.replace(/[^a-zA-Z0-9]/g, '_')} - ${episodeNumber} - ${episodeTitle.replace(/[^a-zA-Z0-9]/g, '_')}`;

                    if (!isEpisodeDownloaded(fileName)) {
                        await downloadPodcastEpisode(episodeUrl, fileName);
                    } else {
                        console.log(`Episode already downloaded: ${fileName}`);
                    }
                }
            } else {
                console.log(`No episodes found in feed: ${url}`);
            }
        } catch (error) {
            console.error(`Failed to fetch feed: ${url}`, error);
        }
    }
}

fetchAndDownloadLatestEpisodes();