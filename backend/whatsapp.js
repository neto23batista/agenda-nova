'use strict';

const axios = require('axios');

require('dotenv').config();

const PROVIDER = (process.env.WHATSAPP_PROVIDER || 'evolution').toLowerCase();
const SALON = process.env.SALON_NAME || 'Fernanda Silva Nail Designer';

function normalizePhone(raw) {
  if (!raw) return null;

  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length <= 11) digits = `55${digits}`;
  return digits;
}

function fmtDate(dateStr) {
  const [, month, day] = dateStr.split('-');
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const weekDays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const weekday = weekDays[new Date(`${dateStr}T12:00:00`).getDay()];
  return `${weekday}, ${parseInt(day, 10)} de ${months[parseInt(month, 10) - 1]}`;
}

const MSG = {
  confirmClient: appointment => `*Agendamento confirmado!*

Ola, *${appointment.clientName}*!

Seu horario no *${SALON}* foi confirmado:

*Servico:* ${appointment.serviceName}
*Data:* ${fmtDate(appointment.date)}
*Horario:* ${appointment.time}

Se precisar remarcar, avise com antecedencia.`,

  reminderDay: appointment => `*Lembrete para amanha*

Ola, *${appointment.clientName}*!

Passando para lembrar do seu atendimento:

*Servico:* ${appointment.serviceName}
*Data:* ${fmtDate(appointment.date)}
*Horario:* ${appointment.time}
*Local:* ${SALON}

Se precisar cancelar, avise o quanto antes.`,

  reminderHour: appointment => `*Seu atendimento e em 1 hora*

Ola, *${appointment.clientName}*!

Seu horario no *${SALON}* comeca as *${appointment.time}*.
*Servico:* ${appointment.serviceName}

Estamos te esperando.`,

  newBookingOwner: appointment => `*Novo agendamento recebido*

*Cliente:* ${appointment.clientName}
*Telefone:* ${appointment.clientPhone || 'nao informado'}
*Servico:* ${appointment.serviceName}
*Data:* ${fmtDate(appointment.date)}
*Horario:* ${appointment.time}

Acesse o painel para confirmar.`,

  reminderOwner: appointment => `*Atendimento em 1 hora*

*Cliente:* ${appointment.clientName}
*Servico:* ${appointment.serviceName}
*Horario:* ${appointment.time}`,
};

async function sendEvolution(toPhone, message) {
  const number = normalizePhone(toPhone);
  const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;

  const { data } = await axios.post(
    url,
    {
      number,
      textMessage: { text: message },
      options: { delay: 1000 },
    },
    {
      headers: {
        apikey: process.env.EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    },
  );

  return data;
}

async function sendTwilio(toPhone, message) {
  const number = `+${normalizePhone(toPhone)}`;
  const {
    TWILIO_ACCOUNT_SID: sid,
    TWILIO_AUTH_TOKEN: token,
    TWILIO_WHATSAPP_FROM: from,
  } = process.env;

  const { data } = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    new URLSearchParams({
      From: from,
      To: `whatsapp:${number}`,
      Body: message,
    }),
    {
      auth: { username: sid, password: token },
      timeout: 10000,
    },
  );

  return data;
}

async function sendWhatsApp(rawPhone, message) {
  const phone = normalizePhone(rawPhone);

  if (!phone) {
    console.warn('[whatsapp] number missing, message skipped.');
    return { skipped: true, reason: 'no_phone' };
  }

  try {
    const result = PROVIDER === 'twilio'
      ? await sendTwilio(phone, message)
      : await sendEvolution(phone, message);

    console.log(`[whatsapp] sent to ${phone} via ${PROVIDER}`);
    return result;
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error(`[whatsapp] failed for ${phone} via ${PROVIDER}:`, detail);
    return { error: true, detail };
  }
}

module.exports = {
  async notifyConfirmation(appointment) {
    return sendWhatsApp(appointment.clientPhone, MSG.confirmClient(appointment));
  },

  async notifyOwnerNewBooking(appointment) {
    return sendWhatsApp(process.env.OWNER_WHATSAPP, MSG.newBookingOwner(appointment));
  },

  async notifyReminderDay(appointment) {
    return sendWhatsApp(appointment.clientPhone, MSG.reminderDay(appointment));
  },

  async notifyReminderHour(appointment) {
    return sendWhatsApp(appointment.clientPhone, MSG.reminderHour(appointment));
  },

  async notifyOwnerReminder(appointment) {
    return sendWhatsApp(process.env.OWNER_WHATSAPP, MSG.reminderOwner(appointment));
  },

  sendWhatsApp,
  normalizePhone,
};
