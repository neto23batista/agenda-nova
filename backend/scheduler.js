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

function isWithinOneHour(appt) {
  const now   = new Date();
  const apptD = new Date(`${appt.date}T${appt.time}:00`);
  const diff  = apptD.getTime() - now.getTime();
  return diff > 0 && diff <= 60 * 60 * 1000; // até 1h
}

// ── Executa a verificação ────────────────────────────────────
async function runCheck() {
  const ts = new Date().toLocaleString('pt-BR');
  console.log(`\n⏰ [${ts}] Scheduler: verificando lembretes...`);

  const today    = todayStr();
  const tomorrow = tomorrowStr();
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
      if (!appt.reminded_hour && isWithinOneHour(appt)) {
        console.log(`  ⏰ H-1 → ${appt.clientName} (${appt.date} às ${appt.time})`);
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
