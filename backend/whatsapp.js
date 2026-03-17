// ═══════════════════════════════════════════════════════════
//  whatsapp.js — Serviço de notificações WhatsApp
//  Suporta: Evolution API (gratuito) | Twilio (pago)
// ═══════════════════════════════════════════════════════════
'use strict';

const axios  = require('axios');
require('dotenv').config();

const PROVIDER = (process.env.WHATSAPP_PROVIDER || 'evolution').toLowerCase();
const SALON    = process.env.SALON_NAME || 'Belle Studio';

// ── Normaliza número para formato internacional ─────────────
// Entrada:  "(11) 98888-7777"  →  Saída: "5511988887777"
function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('0'))  digits = digits.slice(1);
  if (digits.length <= 11)     digits = '55' + digits;  // adiciona DDI Brasil
  return digits;
}

// ── Formata data em português ───────────────────────────────
function fmtDate(dateStr) {
  const [, m, d]  = dateStr.split('-');
  const months    = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const weekDays  = ['dom','seg','ter','qua','qui','sex','sáb'];
  const dow       = weekDays[new Date(dateStr + 'T12:00:00').getDay()];
  return `${dow}, ${parseInt(d)} de ${months[parseInt(m) - 1]}`;
}

// ── Templates de mensagem ────────────────────────────────────
const MSG = {

  // Para a CLIENTE quando o dono confirmar
  confirmClient: (a) => `✅ *Agendamento Confirmado!*

Olá, *${a.clientName}*! 🌸

Seu atendimento no *${SALON}* está confirmado:

💅 *Serviço:* ${a.serviceName}
📅 *Data:* ${fmtDate(a.date)}
🕐 *Horário:* ${a.time}

Em caso de imprevisto, avise com antecedência.
Te esperamos! 💖`,

  // Para a CLIENTE — lembrete 1 dia antes
  reminderDay: (a) => `⏰ *Lembrete para amanhã!*

Oi, *${a.clientName}*! 😊

Lembrando do seu atendimento amanhã:

💅 *Serviço:* ${a.serviceName}
📅 *Data:* ${fmtDate(a.date)}
🕐 *Horário:* ${a.time}
📍 *Local:* ${SALON}

_Precisa cancelar? Avise o quanto antes._ 🙏`,

  // Para a CLIENTE — lembrete 1 hora antes
  reminderHour: (a) => `🔔 *Daqui 1 hora!*

Oi, *${a.clientName}*! ✨

Seu atendimento no *${SALON}* é às *${a.time}*.
💅 *Serviço:* ${a.serviceName}

Nos vemos em breve! 🌸`,

  // Para o DONO — novo agendamento solicitado
  newBookingOwner: (a) => `🔔 *Novo Agendamento!*

👩 *Cliente:* ${a.clientName}
📱 *Telefone:* ${a.clientPhone || 'não informado'}
💅 *Serviço:* ${a.serviceName}
📅 *Data:* ${fmtDate(a.date)}
🕐 *Horário:* ${a.time}

_Acesse o painel para confirmar._`,

  // Para o DONO — lembrete de atendimento próximo
  reminderOwner: (a) => `📅 *Atendimento em 1 hora!*

👩 *${a.clientName}*
💅 *${a.serviceName}*
🕐 *${a.time}*

_Bom atendimento!_ 🌸`,
};

// ═══════════════════════════════════════════════════════════
//  ENVIO POR PROVEDOR
// ═══════════════════════════════════════════════════════════

async function sendEvolution(toPhone, message) {
  const number = normalizePhone(toPhone);
  const url    = `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;

  const { data } = await axios.post(url, {
    number,
    textMessage: { text: message },
    options: { delay: 1000 },
  }, {
    headers: {
      'apikey':        process.env.EVOLUTION_API_KEY,
      'Content-Type':  'application/json',
    },
    timeout: 10000,
  });

  return data;
}

async function sendTwilio(toPhone, message) {
  const number = '+' + normalizePhone(toPhone);
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WHATSAPP_FROM: from } = process.env;

  const { data } = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    new URLSearchParams({ From: from, To: `whatsapp:${number}`, Body: message }),
    { auth: { username: sid, password: token }, timeout: 10000 }
  );

  return data;
}

// ── Função principal ─────────────────────────────────────────
async function sendWhatsApp(rawPhone, message) {
  const phone = normalizePhone(rawPhone);

  if (!phone) {
    console.warn('⚠️  Número não informado — mensagem ignorada.');
    return { skipped: true, reason: 'no_phone' };
  }

  try {
    const result = PROVIDER === 'twilio'
      ? await sendTwilio(phone, message)
      : await sendEvolution(phone, message);

    console.log(`✅ WhatsApp enviado → ${phone} (${PROVIDER})`);
    return result;

  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error(`❌ Falha ao enviar para ${phone} via ${PROVIDER}:`, detail);
    return { error: true, detail };  // não lança exceção — não quebra o fluxo
  }
}

// ═══════════════════════════════════════════════════════════
//  FUNÇÕES EXPORTADAS POR EVENTO
// ═══════════════════════════════════════════════════════════

module.exports = {

  // Dono confirmou → avisa a cliente
  async notifyConfirmation(appt) {
    return sendWhatsApp(appt.clientPhone, MSG.confirmClient(appt));
  },

  // Cliente agendou → avisa o dono
  async notifyOwnerNewBooking(appt) {
    return sendWhatsApp(process.env.OWNER_WHATSAPP, MSG.newBookingOwner(appt));
  },

  // Lembrete 1 dia antes → para a cliente
  async notifyReminderDay(appt) {
    return sendWhatsApp(appt.clientPhone, MSG.reminderDay(appt));
  },

  // Lembrete 1 hora antes → para a cliente
  async notifyReminderHour(appt) {
    return sendWhatsApp(appt.clientPhone, MSG.reminderHour(appt));
  },

  // Lembrete 1 hora antes → para o dono
  async notifyOwnerReminder(appt) {
    return sendWhatsApp(process.env.OWNER_WHATSAPP, MSG.reminderOwner(appt));
  },

  sendWhatsApp,
  normalizePhone,
};
