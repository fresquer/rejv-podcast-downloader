#!/bin/bash

# Directorio donde están los archivos MP3
DIRECTORIO="./podcast_episodes"

# Convertir cada archivo MP3 a 128kbps mono
for archivo in "$DIRECTORIO"/*.mp3; do
    ffmpeg -i "$archivo" -b:a 128k -ac 1 "${archivo%.mp3}_128kbps_mono.mp3"
done
