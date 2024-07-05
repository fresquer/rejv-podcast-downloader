const RSSParser = require('rss-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const id3 = require('node-id3');

const podcastJsonFile = 'shows_db.json';
const downloadDirectory = 'podcast_episodes';

if (!fs.existsSync(downloadDirectory)) {
    fs.mkdirSync(downloadDirectory);
}

function isEpisodeDownloaded(fileName) {
    const filePath = path.join(downloadDirectory, `${fileName}.mp3`);
    return fs.existsSync(filePath);
}

async function downloadPodcastEpisode(episodeUrl, fileName, metadata) {
    try {
        const response = await axios.get(episodeUrl, { responseType: 'arraybuffer' });
        const filePath = path.join(downloadDirectory, `${fileName}.mp3`);
        fs.writeFileSync(filePath, response.data);
        console.log(`Downloaded: ${fileName}`);

        // Add ID3 tags
        const tags = {
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            trackNumber: metadata.trackNumber,
            genre: metadata.genre,
            year: metadata.year
        };
        id3.write(tags, filePath);
        console.log(`Tagged: ${fileName}`);
    } catch (error) {
        console.error(`Failed to download: ${fileName}`, error);
    }
}

async function fetchAndDownloadLatestEpisodes() {
    try {
        const podcastJson = JSON.parse(fs.readFileSync(podcastJsonFile, 'utf8'));

        const parser = new RSSParser();

        for (const podcast of podcastJson) {
            try {
                const feed = await parser.parseURL(podcast.rss);
                if (feed.items.length > 0) {
                    const latestEpisode = feed.items[0]; // Get the latest episode
                    const programName = podcast.nombre;
                    const episodeTitle = latestEpisode.title;
                    const episodeUrl = latestEpisode.enclosure.url;
                    const episodeNumber = latestEpisode.itunes && latestEpisode.itunes.episode ? latestEpisode.itunes.episode : 'unknown';
                    const episodeDate = latestEpisode.pubDate ? new Date(latestEpisode.pubDate).getFullYear().toString() : 'unknown';

                    const fileName = `${programName.replace(/[^a-zA-Z0-9]/g, '_')} - ${episodeNumber} - ${episodeTitle.replace(/[^a-zA-Z0-9]/g, '_')}`;

                    if (!isEpisodeDownloaded(fileName)) {
                        const metadata = {
                            title: episodeTitle,
                            artist: programName,
                            album: programName,
                            trackNumber: episodeNumber,
                            genre: 'Podcast',
                            year: episodeDate
                        };
                        await downloadPodcastEpisode(episodeUrl, fileName, metadata);
                    } else {
                        console.log(`Episode already downloaded: ${fileName}`);
                    }
                } else {
                    console.log(`No episodes found in feed: ${podcast.rss}`);
                }
            } catch (error) {
                console.error(`Failed to fetch feed: ${podcast.rss}`, error);
            }
        }
    } catch (error) {
        console.error(`Failed to read JSON file: ${podcastJsonFile}`, error);
    }
}

fetchAndDownloadLatestEpisodes();
