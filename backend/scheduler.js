// ═══════════════════════════════════════════════════════════
//  scheduler.js — Lembretes automáticos WhatsApp
//  Verifica a cada 30 minutos quem precisa de lembrete
// ═══════════════════════════════════════════════════════════
'use strict';

const cron = require('node-cron');
const { DB } = require('./db');
const {
  notifyReminderDay,
  notifyReminderHour,
  notifyOwnerReminder,
} = require('./whatsapp');

// ── Helpers de data/hora ─────────────────────────────────────
const pad = n => String(n).padStart(2, '0');

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// Retorna os dois próximos slots (HH:00 e HH:30) a partir de agora + 1h
function getSlotsInOneHour() {
  const h = new Date().getHours() + 1;
  return [`${pad(h)}:00`, `${pad(h)}:30`];
}

// ── Executa a verificação ────────────────────────────────────
async function runCheck() {
  const ts = new Date().toLocaleString('pt-BR');
  console.log(`\n⏰ [${ts}] Scheduler: verificando lembretes...`);

  const today    = todayStr();
  const tomorrow = tomorrowStr();
  const slots1h  = getSlotsInOneHour();
  let   sent     = 0;

  try {
    const appts = DB.getConfirmedFrom(today);

    for (const appt of appts) {

      // ── D-1: lembrete para amanhã ─────────────────────────
      if (appt.date === tomorrow && !appt.reminded_day) {
        console.log(`  📅 D-1 → ${appt.clientName} (${appt.date} às ${appt.time})`);
        await notifyReminderDay(appt);
        DB.markReminded(appt.id, 'day');
        sent++;
      }

      // ── H-1: lembrete 1 hora antes ────────────────────────
      if (appt.date === today && !appt.reminded_hour && slots1h.includes(appt.time)) {
        console.log(`  ⏰ H-1 → ${appt.clientName} (hoje às ${appt.time})`);
        await notifyReminderHour(appt);
        await notifyOwnerReminder(appt);
        DB.markReminded(appt.id, 'hour');
        sent++;
      }
    }

    console.log(`  ✅ ${appts.length} agendamento(s) verificado(s), ${sent} lembrete(s) enviado(s).`);

  } catch (err) {
    console.error('  ❌ Erro no scheduler:', err.message);
  }
}

// ── Inicia o cron ────────────────────────────────────────────
function startScheduler() {
  // Roda a cada 30 minutos
  cron.schedule('*/30 * * * *', runCheck);

  // Roda uma vez 5 segundos após iniciar (pega pendentes imediatos)
  setTimeout(runCheck, 5000);

  console.log('⏰ Scheduler iniciado — lembretes verificados a cada 30 minutos.');
}

module.exports = { startScheduler };
