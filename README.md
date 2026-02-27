# Rejv Last Episodes Sync

Script que descarga los últimos episodios de cada podcast desde sus RSS, los etiqueta y los sincroniza con **AzuraCast** (lista de retransmisión). Pensado para ejecutarse cada 24h en un VPS sin intervención manual.

## Requisitos

- Node.js
- npm

## Instalación

1. Clonar el repositorio e instalar dependencias:

   ```bash
   git clone <url-del-repo>
   cd rejv-last-episodes-sync
   npm install
   ```

2. Configurar las variables de entorno (ver más abajo).

## Configuración (variables de entorno)

| Variable | Obligatorio | Descripción |
|----------|-------------|-------------|
| `AZURACAST_API_KEY` | Sí | API Key de AzuraCast. Crearla en el panel: usuario → "My API Keys". El usuario debe tener permiso "Manage Station Media". |
| `AZURACAST_URL` | No | URL base de AzuraCast. Por defecto: `https://live.radioespaijove.es` |
| `AZURACAST_STATION_ID` | No | ID de la estación. Si no se define, se usa la primera estación devuelta por la API. |
| `AZURACAST_UPLOAD_PATH` | No | Carpeta dentro de la estación donde subir los MP3 (ej: `retransmision`). Si la playlist de retransmisión está asociada a una carpeta, pon aquí su nombre. |
| `DISCORD_WEBHOOK_URL` | No | URL del webhook de Discord para recibir un mensaje al terminar cada ejecución (éxito o error). |

Recomendación: usar un fichero `.env` en la raíz del proyecto (ya está en `.gitignore`) y cargarlo con `dotenv` o exportando las variables antes de ejecutar. Ejemplo para ejecución manual:

```bash
export AZURACAST_API_KEY="tu_api_key"
npm start
```

## Uso

1. Asegúrate de que `shows_db.json` tiene la lista de podcasts con `nombre`, `key` y `rss` para cada uno.

2. **Sincronización completa** (descarga + subida a AzuraCast):

   ```bash
   npm start
   # o
   npm run sync
   ```

3. **Solo descarga** (sin conectar a AzuraCast):

   ```bash
   npm run run-sync
   ```

El flujo completo:

- Limpia la carpeta local `podcast_episodes/`
- Obtiene los feeds RSS y descarga el episodio más reciente de cada podcast
- Se conecta a AzuraCast, borra los archivos actuales de la estación y sube los nuevos MP3

## Ejecución cada 24h en un VPS (cron)

Para que se refresque solo cada 24 horas:

1. Sube el proyecto al VPS e instala dependencias (`npm install`).
2. Configura las variables de entorno (por ejemplo en un `.env` o en un script que las exporte).
3. Añade una entrada en crontab:

   ```bash
   crontab -e
   ```

   Ejemplo (todos los días a las 3:00):

   ```cron
   0 3 * * * cd /ruta/completa/rejv-last-episodes-sync && export AZURACAST_API_KEY="tu_api_key" && /usr/bin/node src/index.js >> /var/log/rejv-sync.log 2>&1
   ```

   Ajusta `/ruta/completa/rejv-last-episodes-sync` y la ruta de `node` si es necesario. Si usas un `.env`, puedes cargarlo en el script o con `env $(cat .env | xargs)` en el cron (teniendo cuidado con permisos del fichero `.env`, p. ej. `chmod 600 .env`).

## Estructura del proyecto

```
src/
  config.js       # Configuración (env, rutas, carga de shows_db)
  logger.js       # Logging
  index.js        # Entrada principal: orquesta descarga + sync AzuraCast
  podcasts/
    rss.js        # Obtención y parseo de feeds RSS
    downloader.js # Descarga de episodios y etiquetado ID3
  azuracast/
    client.js     # Cliente API AzuraCast (listar, borrar, subir)
  notify/
    discord.js    # Notificación al canal Discord vía webhook
  scripts/
    download-only.js  # Solo descarga (npm run run-sync)
shows_db.json    # Lista de podcasts (nombre, key, rss)
podcast_episodes/    # MP3 antes de subir (ignorado en git)
```

- `npm start` / `npm run sync`: descarga + sincronización con AzuraCast.
- `npm run run-sync`: solo descarga de episodios (sin AzuraCast).

## Dependencias

- axios: peticiones HTTP y API de AzuraCast
- form-data: subida multipart a AzuraCast
- node-id3: etiquetado ID3 de los MP3
- rss-parser / xml2js: parsing de feeds RSS
