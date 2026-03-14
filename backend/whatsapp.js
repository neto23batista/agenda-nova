// ─────────────────────────────────────────────────────────
//  whatsapp.js — Serviço de notificações WhatsApp
//  Suporta: Evolution API (gratuito) e Twilio (pago)
// ─────────────────────────────────────────────────────────
const axios = require('axios');
require('dotenv').config();

const PROVIDER  = process.env.WHATSAPP_PROVIDER || 'evolution';
const SALON     = process.env.SALON_NAME || 'Belle Studio';

// ── Normaliza número para formato internacional ──────────
function normalizePhone(phone) {
  // Remove tudo que não é número
  let digits = phone.replace(/\D/g, '');
  // Se começa com 0, remove
  if (digits.startsWith('0')) digits = digits.slice(1);
  // Se não tem código do país (BR = 55), adiciona
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }
  return digits; // ex: 5511999990000
}

// ── Formata data para português ─────────────────────────
function fmtDatePT(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const days   = ['dom','seg','ter','qua','qui','sex','sáb'];
  const dayOfWeek = days[new Date(dateStr + 'T12:00:00').getDay()];
  return `${dayOfWeek}, ${parseInt(d)} de ${months[parseInt(m)-1]}`;
}

// ── Monta as mensagens ───────────────────────────────────
const TEMPLATES = {

  // Enviada para a CLIENTE quando o dono confirmar o atendimento
  confirmClient: ({ clientName, serviceName, date, time, salonName }) => `
✅ *Agendamento Confirmado!*

Olá, *${clientName}*! 🌸

Seu atendimento no *${salonName}* foi confirmado:

📋 *Serviço:* ${serviceName}
📅 *Data:* ${fmtDatePT(date)}
🕐 *Horário:* ${time}

_Qualquer dúvida, entre em contato conosco._

Até breve! 💅
`.trim(),

  // Lembrete 1 dia antes — para a CLIENTE
  reminderDayBefore: ({ clientName, serviceName, date, time, salonName }) => `
⏰ *Lembrete de Amanhã!*

Oi, *${clientName}*! 😊

Lembrando que amanhã você tem atendimento:

💅 *Serviço:* ${serviceName}
📅 *Data:* ${fmtDatePT(date)}
🕐 *Horário:* ${time}
📍 *Local:* ${salonName}

_Se precisar cancelar ou remarcar, por favor entre em contato o quanto antes._

Te esperamos! 🌸
`.trim(),

  // Lembrete 1 hora antes — para a CLIENTE
  reminderHourBefore: ({ clientName, serviceName, time, salonName }) => `
🔔 *Daqui 1 hora!*

Oi, *${clientName}*! 

Seu atendimento é às *${time}* no *${salonName}*.

💅 *Serviço:* ${serviceName}

_Nos vemos em breve!_ 😍✨
`.trim(),

  // Alerta para o DONO — novo agendamento pendente
  newBookingOwner: ({ clientName, clientPhone, serviceName, date, time }) => `
🔔 *Novo Agendamento!*

Uma cliente solicitou um horário:

👩 *Cliente:* ${clientName}
📱 *Telefone:* ${clientPhone}
💅 *Serviço:* ${serviceName}
📅 *Data:* ${fmtDatePT(date)}
🕐 *Horário:* ${time}

_Acesse o painel para confirmar ou cancelar._
`.trim(),

  // Alerta para o DONO — lembrete de atendimento no dia
  reminderOwner: ({ clientName, serviceName, time }) => `
📅 *Lembrete do dia!*

Você tem um atendimento hoje:

👩 *${clientName}*
💅 *${serviceName}*
🕐 *${time}*

_Bom atendimento!_ 🌸
`.trim(),
};

// ── Envio via Evolution API ──────────────────────────────
async function sendEvolution(toPhone, message) {
  const number   = normalizePhone(toPhone);
  const url      = `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;
  const headers  = { apikey: process.env.EVOLUTION_API_KEY, 'Content-Type': 'application/json' };
  const body     = { number, textMessage: { text: message } };

  const res = await axios.post(url, body, { headers });
  return res.data;
}

// ── Envio via Twilio ─────────────────────────────────────
async function sendTwilio(toPhone, message) {
  const number = '+' + normalizePhone(toPhone);
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_WHATSAPP_FROM;

  const res = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    new URLSearchParams({ From: from, To: `whatsapp:${number}`, Body: message }),
    { auth: { username: accountSid, password: authToken } }
  );
  return res.data;
}

// ── Função principal de envio ────────────────────────────
async function sendWhatsApp(toPhone, message) {
  if (!toPhone) {
    console.warn('⚠️  Número não informado, mensagem não enviada.');
    return { skipped: true };
  }

  try {
    let result;
    if (PROVIDER === 'twilio') {
      result = await sendTwilio(toPhone, message);
    } else {
      result = await sendEvolution(toPhone, message);
    }
    console.log(`✅ WhatsApp enviado para ${toPhone} via ${PROVIDER}`);
    return result;
  } catch (err) {
    // Não quebra o fluxo principal se o WhatsApp falhar
    console.error(`❌ Erro ao enviar WhatsApp para ${toPhone}:`, err.response?.data || err.message);
    return { error: err.message };
  }
}

// ── Funções exportadas por evento ───────────────────────

/**
 * Chama quando o dono CONFIRMA um agendamento.
 * Envia mensagem para a cliente.
 */
async function notifyConfirmation(appt) {
  const msg = TEMPLATES.confirmClient({
    clientName:  appt.clientName,
    serviceName: appt.serviceName,
    date:        appt.date,
    time:        appt.time,
    salonName:   SALON,
  });
  return sendWhatsApp(appt.clientPhone, msg);
}

/**
 * Chama quando um novo agendamento é criado (pela cliente).
 * Envia alerta para o DONO.
 */
async function notifyOwnerNewBooking(appt) {
  const ownerPhone = process.env.OWNER_WHATSAPP;
  if (!ownerPhone) return { skipped: true };

  const msg = TEMPLATES.newBookingOwner({
    clientName:  appt.clientName,
    clientPhone: appt.clientPhone || 'não informado',
    serviceName: appt.serviceName,
    date:        appt.date,
    time:        appt.time,
  });
  return sendWhatsApp(ownerPhone, msg);
}

/**
 * Lembrete 1 dia antes — para a cliente.
 */
async function notifyReminderDay(appt) {
  const msg = TEMPLATES.reminderDayBefore({
    clientName:  appt.clientName,
    serviceName: appt.serviceName,
    date:        appt.date,
    time:        appt.time,
    salonName:   SALON,
  });
  return sendWhatsApp(appt.clientPhone, msg);
}

/**
 * Lembrete 1 hora antes — para a cliente.
 */
async function notifyReminderHour(appt) {
  const msg = TEMPLATES.reminderHourBefore({
    clientName:  appt.clientName,
    serviceName: appt.serviceName,
    time:        appt.time,
    salonName:   SALON,
  });
  return sendWhatsApp(appt.clientPhone, msg);
}

/**
 * Lembrete para o dono no dia do atendimento.
 */
async function notifyOwnerReminder(appt) {
  const ownerPhone = process.env.OWNER_WHATSAPP;
  if (!ownerPhone) return { skipped: true };

  const msg = TEMPLATES.reminderOwner({
    clientName:  appt.clientName,
    serviceName: appt.serviceName,
    time:        appt.time,
  });
  return sendWhatsApp(ownerPhone, msg);
}

module.exports = {
  notifyConfirmation,
  notifyOwnerNewBooking,
  notifyReminderDay,
  notifyReminderHour,
  notifyOwnerReminder,
  sendWhatsApp,
  normalizePhone,
};
