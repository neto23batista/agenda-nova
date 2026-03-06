// services/whatsappService.js — WhatsApp via Twilio ou Evolution API
const axios = require("axios");

const PROVIDER = process.env.WHATSAPP_PROVIDER || "twilio";

// ── Formatação do número ─────────────────────────────────────

function formatPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

// ── Templates de mensagens ────────────────────────────────────

function reminderMsg(clientName, serviceIcon, serviceName, professionalName, time, price) {
  const first = clientName.split(" ")[0];
  return `Olá, ${first}! 💅

Esse é um lembrete do seu agendamento de *hoje* no *Belle Studio*:

${serviceIcon} *Serviço:* ${serviceName}
👩 *Profissional:* ${professionalName}
🕐 *Horário:* ${time}
💰 *Valor:* R$${price}

Qualquer dúvida, estamos à disposição! Te esperamos. 🌸

— _Belle Studio_`;
}

function newBookingMsg(clientName, serviceName, date, time) {
  const [y,m,d] = date.split("-");
  return `📅 *Novo Agendamento Recebido!*

👩 Cliente: *${clientName}*
💅 Serviço: ${serviceName}
📆 Data: ${d}/${m}/${y} às ${time}

Acesse o painel para confirmar. ✅`;
}

function consentMsg(clientName, type, serviceName, reason, newDate, newTime) {
  const first = clientName.split(" ")[0];
  let body = `⚠️ *Solicitação do Belle Studio*\n\nOlá, ${first}!\n\n`;
  if (type === "cancel") {
    body += `O salão está solicitando o *cancelamento* do seu agendamento de *${serviceName}*.\n\n`;
  } else {
    const [y,m,d] = (newDate||"").split("-");
    body += `O salão está solicitando a *remarcação* do seu agendamento de *${serviceName}* para *${d}/${m}/${y}* às *${newTime}*.\n\n`;
  }
  body += `📌 *Motivo:* ${reason}\n\nAcesse o aplicativo para aceitar ou recusar.`;
  return body;
}

// ── Providers ─────────────────────────────────────────────────

async function sendViaTwilio(to, message) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WHATSAPP_FROM: from } = process.env;
  if (!sid || !token || !from) {
    console.log(`[WHATSAPP/Twilio] Credenciais ausentes — simulando envio para ${to}`);
    return { success: true, simulated: true };
  }
  try {
    const phone = `whatsapp:+${formatPhone(to)}`;
    const res = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      new URLSearchParams({ From: from, To: phone, Body: message }),
      { auth: { username: sid, password: token }, headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    console.log(`[WHATSAPP/Twilio] ✅ Enviado para ${phone} — SID: ${res.data.sid}`);
    return { success: true, sid: res.data.sid };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[WHATSAPP/Twilio] ❌ Erro:`, msg);
    return { success: false, error: msg };
  }
}

async function sendViaEvolution(to, message) {
  const { EVOLUTION_API_URL: url, EVOLUTION_API_KEY: key, EVOLUTION_INSTANCE: instance } = process.env;
  if (!url || !key || !instance) {
    console.log(`[WHATSAPP/Evolution] Config ausente — simulando envio para ${to}`);
    return { success: true, simulated: true };
  }
  try {
    const phone = formatPhone(to);
    const res = await axios.post(
      `${url}/message/sendText/${instance}`,
      { number: phone, textMessage: { text: message } },
      { headers: { apikey: key } }
    );
    console.log(`[WHATSAPP/Evolution] ✅ Enviado para ${phone}`);
    return { success: true, data: res.data };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[WHATSAPP/Evolution] ❌ Erro:`, msg);
    return { success: false, error: msg };
  }
}

async function send(phone, message) {
  console.log(`[WHATSAPP] Usando provider: ${PROVIDER}`);
  if (PROVIDER === "evolution") return sendViaEvolution(phone, message);
  return sendViaTwilio(phone, message);
}

// ── API pública ───────────────────────────────────────────────

async function sendReminder({ phone, clientName, serviceIcon, serviceName, professionalName, time, price }) {
  const msg = reminderMsg(clientName, serviceIcon, serviceName, professionalName, time, price);
  return send(phone, msg);
}

async function sendNewBookingToOwner({ ownerPhone, clientName, serviceName, date, time }) {
  if (!ownerPhone) return { success: false, error: "Sem número do dono" };
  const msg = newBookingMsg(clientName, serviceName, date, time);
  return send(ownerPhone, msg);
}

async function sendConsentRequest({ phone, clientName, type, serviceName, reason, newDate, newTime }) {
  const msg = consentMsg(clientName, type, serviceName, reason, newDate, newTime);
  return send(phone, msg);
}

module.exports = { sendReminder, sendNewBookingToOwner, sendConsentRequest };
