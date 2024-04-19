const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_TOKEN } = require('./config');
const { fetchRestrictions } = require('./dataFetcher');
const { formatRestrictionMessage } = require('./utils');

// Crea una nueva instancia del bot de Telegram
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Define el intervalo para los mensajes
const MESSAGE_INTERVAL = 15 * 60 * 1000; // 15 minutos en milisegundos

// Almacenar el ID del intervalo para controlar el envío de mensajes
let intervalId;

// Función para consultar las restricciones y formatear el mensaje
async function checkAndReportRestrictions() {
    const restrictionsData = await fetchRestrictions();
    return ['AGUIRRE', 'BAHÍA CHACABUCO'].map(bayName => {
        const bayRestrictions = restrictionsData.filter(r => r.GLBahia === bayName);
        return formatRestrictionMessage(bayRestrictions, bayName);
    }).join('\n');
}

// Evento para escuchar los mensajes entrantes
bot.on('message', async (msg) => {
    // Comando para iniciar la consulta y enviar mensajes cada 15 minutos
    if (msg.text.toLowerCase() === '/start') {
        if (intervalId) {
            clearInterval(intervalId);
        }
        const response = await checkAndReportRestrictions();
        bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
        intervalId = setInterval(async () => {
            const response = await checkAndReportRestrictions();
            bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
        }, MESSAGE_INTERVAL);
    }

    // Comando para detener el envío automático de mensajes
    if (msg.text.toLowerCase() === '/stop' && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        bot.sendMessage(msg.chat.id, 'Las actualizaciones automáticas se han detenido.', { parse_mode: 'Markdown' });
    }
});

// Iniciar el bot
bot.startPolling();
