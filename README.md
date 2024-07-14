# Podcast Downloader

This project is a Node.js script that automatically downloads and tags podcast episodes from RSS feeds.

## Requirements

- Node.js
- NPM (Node Package Manager)

## Installation

1. Clone this repository:
    ```bash
    git clone https://github.com/your-username/podcast-downloader.git
    cd podcast-downloader
    ```

2. Install the dependencies:
    ```bash
    npm install
    ```

## Usage

1. Ensure the `shows_db.json` file contains the list of podcasts you want to download. The format for each podcast object in the JSON is as follows:

    ```json
    [
        {
            "name": "Podcast Name",
            "rss": "URL of the podcast's RSS feed"
        }
    ]
    ```

2. Run the script:
    ```bash
    node podcast_downloader.js
    ```

## Project Structure

- `podcast_downloader.js`: The main script that downloads and tags the podcast episodes.
- `shows_db.json`: JSON file containing the list of podcasts and their RSS feed URLs.
- `podcast_episodes/`: Directory where the downloaded episodes are saved.

## Dependencies

- [rss-parser](https://www.npmjs.com/package/rss-parser): For parsing RSS feeds.
- [axios](https://www.npmjs.com/package/axios): For making HTTP requests.
- [fs](https://nodejs.org/api/fs.html):
