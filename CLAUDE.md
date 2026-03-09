# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the full sync (fetch RSS → download → tag → upload to AzuraCast → notify Discord)
npm run sync          # or: node src/index.js

# Download episodes only (no AzuraCast sync, no Discord)
npm run run-sync      # or: node src/scripts/download-only.js

# Test the full flow with 1 podcast (supports DRY_RUN=1 to skip AzuraCast)
npm run test-flow     # or: DRY_RUN=1 node src/scripts/test-full-flow.js

# Test Discord webhook
npm run test-discord

# Clean downloaded episodes
npm run clean-episodes

# Run via PM2 (schedules daily at 03:00)
pm2 start ecosystem.config.cjs
pm2 logs rejv-sync
pm2 stop rejv-sync
```

No build step — plain Node.js (CommonJS/ESM mix, `.js` extension throughout).

## Architecture

**Entry point:** `src/index.js` orchestrates: load shows → Discord notification → download episodes → sync to AzuraCast → Discord summary.

**Data flow:**
1. `src/config.js` — loads `.env`, exports `env` config object, `loadShows()` (fetches show list from `https://radioespaijove.es/api/shows.json`), and `getApiBase()`
2. `src/podcasts/rss.js` — parses RSS feeds (xml2js) per show, returns episodes sorted newest-first
3. `src/podcasts/downloader.js` — two-phase: (1) check all feeds with delays, build queue; (2) stream-download MP3s, embed ID3 tags + cover art via `node-id3`. Keeps only the **latest episode per podcast** — old episodes are deleted when a new one arrives.
4. `src/azuracast/client.js` — syncs local `podcast_episodes/` to AzuraCast using one of three methods (priority order): **SFTP** → **local disk copy** → **HTTP API**. Incremental in all modes (only uploads new, removes deleted).
5. `src/notify/discord.js` — posts to Discord webhook; silently skips if `DISCORD_WEBHOOK_URL` is not set.

**AzuraCast sync method selection** (auto-detected from env vars):
- `AZURACAST_SFTP_HOST` → SFTP mode
- `AZURACAST_LOCAL_MEDIA_PATH` → local copy mode
- `AZURACAST_API_KEY` + `AZURACAST_URL` → API multipart upload mode

**Key env vars** (see `.env.example` for full list):
- `DRY_RUN=1` — download only, skip sync and Discord
- `DOWNLOAD_DELAY_MS` — delay between downloads (default 3000ms, lower if needed)
- `LOG_LEVEL` — debug/info/warn/error (default info)

**Generated files** (git-ignored):
- `podcast_episodes/` — downloaded and tagged MP3s
- `episodes.json` — RSS feed cache updated on each run
- `shows_db.json` — local mirror of the shows API response

## Notes

- Streaming download (`responseType: 'stream'`) is intentional to avoid OOM on VPS with large MP3 files.
- SFTP connections use `ssh2-sftp-client`; the remote directory is created automatically if missing.
- If AzuraCast returns 500 errors, reduce `DOWNLOAD_DELAY_MS` to avoid request saturation.
- PM2 `autorestart: false` is intentional — the script runs to completion then waits for the next cron trigger.
