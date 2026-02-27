const axios = require('axios');
const { env } = require('../config');
const logger = require('../logger');

/**
 * Envía un mensaje al canal de Discord configurado vía webhook.
 * @param {string} content - Texto del mensaje (máx ~2000 caracteres)
 * @returns {Promise<void>}
 */
async function sendDiscordMessage(content) {
    const url = env.discordWebhookUrl;
    if (!url) {
        logger.debug('Discord webhook no configurado (DISCORD_WEBHOOK_URL), no se envía notificación.');
        return;
    }
    try {
        await axios.post(url, { content }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
        });
    } catch (err) {
        logger.warn('No se pudo enviar notificación a Discord:', err.message);
    }
}

module.exports = { sendDiscordMessage };
