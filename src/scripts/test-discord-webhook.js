/**
 * Envía un mensaje de prueba al webhook de Discord.
 * Uso: DISCORD_WEBHOOK_URL="https://..." node src/scripts/test-discord-webhook.js
 * O con .env: npm run test-discord
 */
try {
    require('dotenv').config();
} catch (_) {
    // dotenv opcional
}

const { sendDiscordMessage } = require('../notify/discord');

async function main() {
    const msg = `🧪 **Test webhook** – ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`;
    console.log('Enviando mensaje de prueba a Discord...');
    await sendDiscordMessage(msg);
    console.log('Hecho. Revisa el canal de Discord.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
