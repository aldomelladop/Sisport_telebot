function formatRestrictionMessage(restrictions, bayName) {
    // Emoji para usar en los mensajes
    const noRestrictionsEmoji = '✅';
    const restrictionsEmoji = '⚠️';
  
    if (restrictions.length === 0) {
      return `*No hay restricciones* para la capitanía en la bahía *${bayName}* ${noRestrictionsEmoji}\n---\n`;
    }
  
    return restrictions.map(restriction => {
      return `${restrictionsEmoji} *Hay restricciones para la capitanía en la bahía ${bayName}:*\n` +
        `*Inicio:* \`${restriction.FCinicio}\`\n` +
        `*Tipo:* \`${restriction.tipo}\`\n` +
        `*Observación:* ${restriction.Observacion}\n---\n`;
    }).join('');
  }
  
  module.exports = {
      formatRestrictionMessage
  };
  