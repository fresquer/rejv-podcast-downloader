# Rejv Last Episodes Sync

Script que descarga los últimos episodios de cada podcast desde sus RSS, los etiqueta y los sincroniza con **AzuraCast** (lista de retransmisión). Pensado para ejecutarse cada 24h en un VPS sin intervención manual.

**Sincronización con AzuraCast:** puede hacerse por **copia directa a disco** (mismo servidor, recomendado) o por **API HTTP**. Ver variables de entorno más abajo.

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

2. Copiar `.env.example` a `.env` y configurar las variables (ver más abajo).

## Configuración (variables de entorno)

Copia `.env.example` a `.env` y rellena los valores. Para sincronizar con AzuraCast necesitas **una de estas dos**:

| Variable | Cuándo | Descripción |
|----------|--------|-------------|
| **`AZURACAST_LOCAL_MEDIA_PATH`** | **Mismo servidor (recomendado)** | Ruta en disco de la carpeta de medios, ej: `/var/azuracast/stations/radio_espai_jove/media/retransmision`. Los MP3 se copian aquí directamente (sin HTTP, sin límite 413). |
| **`AZURACAST_API_KEY`** | Otro servidor / subida por API | API Key de AzuraCast (panel → "My API Keys", permiso "Manage Station Media"). Obligatoria si no usas `AZURACAST_LOCAL_MEDIA_PATH`. |

Otras variables:

| Variable | Descripción |
|----------|-------------|
| `AZURACAST_URL` | URL base de AzuraCast. Por defecto: `https://live.radioespaijove.es` (solo para modo API). |
| `AZURACAST_STATION_ID` | ID de la estación (solo modo API). Si no se define, se usa la primera. |
| `AZURACAST_UPLOAD_PATH` | Carpeta dentro de la estación, ej: `retransmision` (solo modo API). |
| `DISCORD_WEBHOOK_URL` | URL del webhook de Discord para notificación al terminar (éxito o error). |

Ejemplo `.env` **en el mismo servidor que AzuraCast**:

```env
AZURACAST_LOCAL_MEDIA_PATH=/var/azuracast/stations/radio_espai_jove/media/retransmision
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Ejemplo `.env` **subiendo por API** (otro servidor):

```env
AZURACAST_API_KEY=tu_api_key
AZURACAST_UPLOAD_PATH=retransmision
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## Uso

1. Asegúrate de que `shows_db.json` tiene la lista de podcasts con `nombre`, `key` y `rss` para cada uno.

2. **Sincronización completa** (descarga + sync a AzuraCast por copia local o API):

   ```bash
   npm start
   # o
   npm run sync
   ```

3. **Solo descarga** (sin sincronizar con AzuraCast):

   ```bash
   npm run run-sync
   ```

El flujo completo:

- Limpia la carpeta local `podcast_episodes/`
- Obtiene los feeds RSS y descarga el episodio más reciente de cada podcast
- **Sincroniza con AzuraCast:** si está definido `AZURACAST_LOCAL_MEDIA_PATH`, copia los MP3 a esa carpeta en disco; si no, usa la API (borra archivos actuales y sube los nuevos)

## Ejecución cada 24h en un VPS (cron)

Para que se refresque solo cada 24 horas:

1. Sube el proyecto al VPS e instala dependencias (`npm install`).
2. Configura las variables de entorno (por ejemplo en un `.env` o en un script que las exporte).
3. Añade una entrada en crontab:

   ```bash
   crontab -e
   ```

   Ejemplo (todos los días a las 3:00), **mismo servidor que AzuraCast** (copia local):

   ```cron
   0 3 * * * cd /ruta/completa/rejv-last-episodes-sync && /usr/bin/node src/index.js >> /var/log/rejv-sync.log 2>&1
   ```
   (El script carga `.env` automáticamente; en `.env` define `AZURACAST_LOCAL_MEDIA_PATH`.)

   Ejemplo **subiendo por API** (otro servidor):

   ```cron
   0 3 * * * cd /ruta/completa/rejv-last-episodes-sync && export AZURACAST_API_KEY="tu_api_key" && /usr/bin/node src/index.js >> /var/log/rejv-sync.log 2>&1
   ```

   Ajusta `/ruta/completa/rejv-last-episodes-sync` y la ruta de `node` si es necesario. Con `.env` en la raíz, el script lo carga con `dotenv` (permisos recomendados: `chmod 600 .env`).

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
    client.js     # Sync con AzuraCast: copia local (AZURACAST_LOCAL_MEDIA_PATH) o API
  notify/
    discord.js    # Notificación al canal Discord vía webhook
  scripts/
    download-only.js   # Solo descarga (npm run run-sync)
    test-full-flow.js  # Test flujo completo con 1 podcast (npm run test-flow)
shows_db.json    # Lista de podcasts (nombre, key, rss)
podcast_episodes/    # MP3 antes de subir (ignorado en git)
```

- `npm start` / `npm run sync`: descarga + sincronización con AzuraCast (copia local o API).
- `npm run run-sync`: solo descarga de episodios (sin sync a AzuraCast).
- `npm run test-flow`: test rápido con 1 podcast (respeta `AZURACAST_LOCAL_MEDIA_PATH` o API).

## Ruta de medios en el mismo servidor

Si el script corre **en el mismo servidor** que AzuraCast, define **`AZURACAST_LOCAL_MEDIA_PATH`** en `.env` con la ruta absoluta de la carpeta de medios (o una subcarpeta). Ejemplo:

```env
AZURACAST_LOCAL_MEDIA_PATH=/var/azuracast/stations/radio_espai_jove/media/retransmision
```

- No hace falta `AZURACAST_API_KEY` para la sincronización de medios (sí para Discord si lo usas).
- El script vacía esa carpeta, copia los MP3 y listo. Sin HTTP, sin error 413.
- La ruta base suele ser `/var/azuracast/stations/<nombre_estacion>/media`. Usa o crea una subcarpeta (ej. `retransmision`) y asígnala a la playlist en AzuraCast si aplica.

## Solución de problemas

- **Error 413 (Payload Too Large)** al subir por API: el servidor (p. ej. nginx) limita el tamaño del body. Opciones: (1) Usar **mismo servidor** y `AZURACAST_LOCAL_MEDIA_PATH` (recomendado); (2) Aumentar `client_max_body_size` en nginx (p. ej. `100M`) y recargar nginx.

## Dependencias

- dotenv: carga de variables desde `.env`
- axios: peticiones HTTP y API de AzuraCast
- form-data: subida multipart a AzuraCast
- node-id3: etiquetado ID3 de los MP3
- rss-parser / xml2js: parsing de feeds RSS
