const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const { formatRestrictionMessage } = require("./utils");
require("dotenv").config();

// Configuración del bot con el token
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Variables para almacenar configuraciones de usuarios
const userSettings = {};
const userStates = {}; // Almacena el estado previo para cada usuario

// Función para obtener las restricciones desde la API
async function obtenerEstado() {
    try {
        const response = await axios.post(
            "https://orion.directemar.cl/sitport/back/users/consultaRestricciones",
        );
        const restricciones = response.data.recordsets[0] || [];
        return restricciones;
    } catch (error) {
        console.error("Error al obtener el estado:", error);
        return [];
    }
}

// Función para generar el mensaje de restricciones
function generarMensajeRestricciones(restricciones) {
    const bays = ["AGUIRRE", "BAHÍA CHACABUCO", "FIORDO AYSEN"];
    let anyRestrictions = false;

    const messages = bays
        .map((bayName) => {
            const bayRestrictions = restricciones.filter(
                (r) => r.GLBahia === bayName,
            );
            if (bayRestrictions.length > 0) {
                anyRestrictions = true;
            }
            return formatRestrictionMessage(bayRestrictions, bayName);
        })
        .join("\n");

    if (anyRestrictions) {
        return (
            "SitportBot:\n" +
            messages +
            "\n⚠️ Capitanía de Puerto Chacabuco: CERRADA"
        );
    }

    return "SitportBot:\n" + messages;
}

// Función para configurar el envío de notificaciones
function configurarEnvioNotificaciones(userId, intervalo) {
    if (userSettings[userId]?.intervaloEnvio) {
        clearInterval(userSettings[userId].intervaloEnvio);
    }

    // Inicializa el estado previo si no existe
    if (!userStates[userId]) {
        userStates[userId] = "";
    }

    userSettings[userId].intervaloEnvio = setInterval(async () => {
        try {
            const restricciones = await obtenerEstado();
            const message = generarMensajeRestricciones(restricciones);

            const estadoPrevio = userStates[userId];

            if (estadoPrevio !== message) {
                // Hubo cambios, enviar el nuevo mensaje
                bot.sendMessage(userId, message, { parse_mode: "Markdown" });
                // Actualizar el estado previo
                userStates[userId] = message;
            } else {
                // No hubo cambios, enviar mensaje indicando que no hay cambios
                bot.sendMessage(
                    userId,
                    "Actualmente no se registraron cambios desde el último reporte.",
                );
            }
        } catch (error) {
            console.error("Error al enviar el mensaje:", error);
            bot.sendMessage(
                userId,
                "Ocurrió un error al obtener las restricciones.",
            );
        }
    }, intervalo * 60000); // Convertir minutos a milisegundos
}

// Función para verificar cambios de estado (para opción 2)
function verificarCambioEstado(userId) {
    obtenerEstado().then((restricciones) => {
        const message = generarMensajeRestricciones(restricciones);
        const estadoActual = message;

        const estadoPrevio = userStates[userId];
        if (estadoPrevio !== undefined && estadoPrevio !== estadoActual) {
            bot.sendMessage(userId, `El estado ha cambiado:\n${estadoActual}`, {
                parse_mode: "Markdown",
            });
        }
        userStates[userId] = estadoActual; // Actualiza el estado previo
    });
}

// Escucha de comandos de Telegram
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        // Obtener y enviar el estado actual
        const restricciones = await obtenerEstado();
        const message = generarMensajeRestricciones(restricciones);
        await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });

        // Actualizar el estado previo para el usuario
        userStates[chatId] = message;
    } catch (error) {
        console.error("Error al enviar el mensaje:", error);
        await bot.sendMessage(
            chatId,
            "Ocurrió un error al obtener las restricciones.",
        );
    }

    // Enviar las opciones al usuario
    await bot.sendMessage(
        chatId,
        "Por favor, elija una opción:\n1. Enviar notificaciones cada X minutos.\n2. Enviar notificaciones cada vez que cambie el estado.",
    );
});

bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim().toLowerCase();

    if (text === "1") {
        // Cambia el estado del usuario a "esperando el tiempo"
        userSettings[chatId] = { modo: "intervalo", esperandoTiempo: true };
        bot.sendMessage(
            chatId,
            "Por favor, ingrese el tiempo en minutos para las notificaciones:",
        );
    } else if (userSettings[chatId]?.esperandoTiempo) {
        const intervalo = parseInt(text);

        if (!isNaN(intervalo) && intervalo > 0) {
            userSettings[chatId].esperandoTiempo = false;
            userSettings[chatId].intervalo = intervalo;

            configurarEnvioNotificaciones(chatId, intervalo);
            bot.sendMessage(
                chatId,
                `Notificaciones configuradas para cada ${intervalo} minutos.`,
            );
        } else {
            bot.sendMessage(
                chatId,
                "Por favor, ingrese un tiempo válido en minutos.",
            );
        }
    } else if (text === "2") {
        if (!userSettings[chatId]) {
            userSettings[chatId] = {};
        }
        userSettings[chatId].modo = "cambio_estado";

        if (userSettings[chatId].intervaloVerificacion) {
            clearInterval(userSettings[chatId].intervaloVerificacion);
        }
        userSettings[chatId].intervaloVerificacion = setInterval(() => {
            if (userSettings[chatId].modo === "cambio_estado") {
                verificarCambioEstado(chatId);
            }
        }, 30000); // Verifica cada 30 segundos

        bot.sendMessage(
            chatId,
            "Notificaciones configuradas para cada cambio de estado.",
        );
    } else if (text.startsWith("/detener")) {
        if (userSettings[chatId]?.intervaloEnvio) {
            clearInterval(userSettings[chatId].intervaloEnvio);
        }
        if (userSettings[chatId]?.intervaloVerificacion) {
            clearInterval(userSettings[chatId].intervaloVerificacion);
        }
        delete userSettings[chatId];
        delete userStates[chatId];

        bot.sendMessage(chatId, "Notificaciones detenidas.");
    } else if (text.startsWith("/estado_actual")) {
        obtenerEstado().then((restricciones) => {
            const message = generarMensajeRestricciones(restricciones);
            bot.sendMessage(chatId, message, { parse_mode: "Markdown" });

            // Actualizar el estado previo para el usuario
            userStates[chatId] = message;
        });
    }
});
