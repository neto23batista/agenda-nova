// ─────────────────────────────────────────────────────────
//  scheduler.js — Lembretes automáticos via WhatsApp
//  Roda a cada 30 minutos
// ─────────────────────────────────────────────────────────
const cron = require('node-cron');
const { DB } = require('./db');
const {
  notifyReminderDay,
  notifyReminderHour,
  notifyOwnerReminder,
} = require('./whatsapp');

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// Retorna o horário daqui 1 hora no formato HH:MM e HH:30
function oneHourAheadSlots() {
  const now  = new Date();
  const h    = now.getHours() + 1;
  const pad  = n => String(n).padStart(2, '0');
  return [`${pad(h)}:00`, `${pad(h)}:30`];
}

async function runCheck() {
  console.log('\n⏰ Scheduler: verificando lembretes —', new Date().toLocaleString('pt-BR'));

  try {
    const today    = todayStr();
    const tomorrow = tomorrowStr();
    const slots1h  = oneHourAheadSlots();

    const appts = DB.getConfirmedFrom(today);
    let sentCount = 0;

    for (const appt of appts) {

      // ── Lembrete 1 DIA ANTES ─────────────────────────
      if (appt.date === tomorrow && !appt.reminded_day) {
        console.log(`📅 D-1: ${appt.clientName} — ${appt.date} às ${appt.time}`);
        await notifyReminderDay(appt);
        DB.markRemindedDay(appt.id);
        sentCount++;
      }

      // ── Lembrete 1 HORA ANTES ────────────────────────
      if (appt.date === today && !appt.reminded_hour && slots1h.includes(appt.time)) {
        console.log(`⏰ H-1: ${appt.clientName} — hoje às ${appt.time}`);
        await notifyReminderHour(appt);
        await notifyOwnerReminder(appt);
        DB.markRemindedHour(appt.id);
        sentCount++;
      }
    }

    console.log(`✅ Verificação concluída: ${appts.length} agendamento(s), ${sentCount} lembrete(s) enviado(s).`);
  } catch (err) {
    console.error('❌ Erro no scheduler:', err.message);
  }
}

function startScheduler() {
  console.log('⏰ Scheduler iniciado — verificação a cada 30 minutos.');

  // Roda a cada 30 minutos
  cron.schedule('*/30 * * * *', runCheck);

  // Roda uma vez ao iniciar para não perder lembretes pendentes
  setTimeout(runCheck, 3000);
}

module.exports = { startScheduler };
