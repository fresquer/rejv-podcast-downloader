# Rejv Last Episodes Sync

Script que descarga los últimos episodios de cada podcast desde sus RSS, los etiqueta y los sincroniza con **AzuraCast** (lista de retransmisión). Pensado para ejecutarse cada 24h en un VPS sin intervención manual.

**Sincronización con AzuraCast:** por **SFTP** (recomendado), **copia directa a disco** (mismo servidor) o **API HTTP**. Ver variables de entorno más abajo.

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

Copia `.env.example` a `.env` y rellena los valores. Para sincronizar con AzuraCast necesitas **una de estas tres**:

| Variable / método | Cuándo | Descripción |
|-------------------|--------|-------------|
| **`AZURACAST_SFTP_*`** | **Subida por SFTP (recomendado)** | Host, usuario, contraseña y ruta remota. AzuraCast expone SFTP (p. ej. Docker). Sin límite 413. |
| **`AZURACAST_LOCAL_MEDIA_PATH`** | Mismo servidor | Ruta en disco de la carpeta de medios. Copia directa, sin red. |
| **`AZURACAST_API_KEY`** | Subida por API | API Key de AzuraCast. Puede dar 413 con archivos grandes si nginx limita el body. |

Variables SFTP (todas obligatorias si usas SFTP):

| Variable | Descripción |
|----------|-------------|
| `AZURACAST_SFTP_HOST` | Host o IP del servidor SFTP (ej. del servidor AzuraCast). |
| `AZURACAST_SFTP_PORT` | Puerto (por defecto 22). |
| `AZURACAST_SFTP_USER` | Usuario SFTP. |
| `AZURACAST_SFTP_PASSWORD` | Contraseña SFTP. |
| `AZURACAST_SFTP_REMOTE_PATH` | Ruta remota de la carpeta de medios (ej. `/media/retransmision`). |

Otras variables (API / opcionales):

| Variable | Descripción |
|----------|-------------|
| `AZURACAST_URL` | URL base de AzuraCast (solo modo API). Por defecto: `https://live.radioespaijove.es`. |
| `AZURACAST_STATION_ID` | ID de la estación (solo modo API). |
| `AZURACAST_UPLOAD_PATH` | Carpeta dentro de la estación (solo modo API). |
| `DISCORD_WEBHOOK_URL` | Webhook de Discord para notificación al terminar. |

Ejemplo `.env` **con SFTP**:

```env
AZURACAST_SFTP_HOST=tu-servidor.com
AZURACAST_SFTP_PORT=22
AZURACAST_SFTP_USER=azuracast_user
AZURACAST_SFTP_PASSWORD=tu_password
AZURACAST_SFTP_REMOTE_PATH=/media/retransmision
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Ejemplo `.env` **mismo servidor** (copia a disco):

```env
AZURACAST_LOCAL_MEDIA_PATH=/var/azuracast/stations/radio_espai_jove/media/retransmision
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Ejemplo `.env` **subiendo por API**:

```env
AZURACAST_API_KEY=tu_api_key
AZURACAST_UPLOAD_PATH=retransmision
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

## Uso

1. La lista de programas se obtiene de `https://radioespaijove.es/api/shows.json` (cada show con `nombre`, `key` y `rss`; solo se procesan los que tienen RSS).

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
- **Sincroniza con AzuraCast:** si están definidos los SFTP, sube por SFTP; si no, si está `AZURACAST_LOCAL_MEDIA_PATH`, copia a disco; si no, usa la API (borra archivos actuales y sube los nuevos)

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

## Ejecución con PM2

Alternativa a cron: PM2 puede ejecutar el sync cada 24h usando el archivo de configuración incluido.

1. Instala PM2 (global): `npm install -g pm2`
2. Crea la carpeta de logs (opcional): `mkdir logs`
3. Arranca la app con el ecosistema:

   ```bash
   pm2 start ecosystem.config.cjs
   ```

4. Para que PM2 arranque al reiniciar el servidor: `pm2 startup` y luego `pm2 save`

Al hacer `pm2 start`, el sync se ejecuta **en ese momento** (primera vez). Luego está programado para repetirse **cada día a las 3:00** (`cron_restart: '0 3 * * *'`). Cuando el script termina, no se reinicia hasta la próxima hora programada.

Comandos útiles:

- `pm2 list` — ver estado
- `pm2 logs rejv-sync` — ver logs en tiempo real
- `pm2 restart rejv-sync` — ejecutar un sync manual ahora (y volver a programar el siguiente cron)
- `pm2 delete rejv-sync` — quitar el proceso de PM2

Para cambiar la hora, edita `cron_restart` en `ecosystem.config.cjs` (formato cron: minuto hora día-mes mes día-semana).

## Estructura del proyecto

```
src/
  config.js       # Configuración (env, rutas, carga de shows desde API)
  logger.js       # Logging
  index.js        # Entrada principal: orquesta descarga + sync AzuraCast
  podcasts/
    rss.js        # Obtención y parseo de feeds RSS
    downloader.js # Descarga de episodios y etiquetado ID3
  azuracast/
    client.js     # Sync con AzuraCast: SFTP, copia local o API
  notify/
    discord.js    # Notificación al canal Discord vía webhook
  scripts/
    download-only.js   # Solo descarga (npm run run-sync)
    test-full-flow.js  # Test flujo completo con 1 podcast (npm run test-flow)
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

## Playlist y reinicio (SFTP / copia local)

Cuando subes por **SFTP** o **copia local**, los archivos van a una carpeta del servidor. Para que suenen en la radio:

1. **Asignar la carpeta a una playlist**  
   En AzuraCast: **Media** → gestiona carpetas → asigna la carpeta donde subes (ej. `/` o `/media/retransmision`) a la playlist de retransmisión. Así los archivos nuevos se añaden solos a esa playlist.

2. **Escaneo de medios**  
   AzuraCast ejecuta una tarea periódica (CheckMedia) que escanea la carpeta. Los archivos pueden tardar unos minutos en aparecer en la biblioteca. Si no aparecen, en el panel puedes lanzar manualmente la sincronización/tareas.

3. **Reinicio de la estación**  
   Si además defines **`AZURACAST_API_KEY`** (aunque uses SFTP o copia local), el script llamará a la API para **reiniciar la estación** después de cada subida. Así los servicios de retransmisión recargan la lista y los nuevos MP3 se empiezan a emitir sin esperar al siguiente ciclo. La API key debe tener permiso para gestionar la estación.

## Solución de problemas

- **Muchos 500 al descargar**: los servidores de los podcasts (p. ej. iVoox) pueden devolver 500 si reciben muchas peticiones seguidas o limitar por IP. Añade en `.env` una pausa entre podcasts, por ejemplo `DOWNLOAD_DELAY_MS=2000` (2 segundos). Así se espacian las descargas y suele bajar el número de fallos. Opcional: `DOWNLOAD_TIMEOUT_MS=120000` (2 min por archivo) para no quedarse colgado si un servidor no responde.

- **Error 413 (Payload Too Large)** al subir por API: el servidor (p. ej. nginx) limita el tamaño del body. Opciones: (1) Usar **SFTP** (`AZURACAST_SFTP_*`); (2) Usar **mismo servidor** y `AZURACAST_LOCAL_MEDIA_PATH`; (3) Aumentar `client_max_body_size` en nginx (p. ej. `100M`) y recargar nginx.

## Dependencias

- dotenv: carga de variables desde `.env`
- axios: peticiones HTTP y API de AzuraCast
- form-data: subida multipart a AzuraCast
- ssh2-sftp-client: subida por SFTP a AzuraCast
- node-id3: etiquetado ID3 de los MP3
- rss-parser / xml2js: parsing de feeds RSS
