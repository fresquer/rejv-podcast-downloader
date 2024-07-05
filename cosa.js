const axios = require('axios');
const xml2js = require('xml2js');

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
    'https://ivoox.com/feed_fg_f12399014_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f12405339_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f1469598_filtro_1.xml',
    'https://www.ivoox.com/feed_fg_f12373342_filtro_1.xml'
];

const parser = new xml2js.Parser();

async function fetchPodcastData(url) {
    try {
        const response = await axios.get(url);
        const result = await parser.parseStringPromise(response.data);
        const title = result.rss.channel[0].title[0];
        return {
            nombre: title,
            key: title.replace(/\s+/g, '-').toLowerCase(),
            rss: url
        };
    } catch (error) {
        console.error(`Error fetching data from ${url}:`, error);
        return null;
    }
}

async function main() {
    const podcastPromises = rssUrls.map(url => fetchPodcastData(url));
    const podcasts = await Promise.all(podcastPromises);
    const validPodcasts = podcasts.filter(podcast => podcast !== null);
    console.log(JSON.stringify(validPodcasts, null, 2));
}

main();
