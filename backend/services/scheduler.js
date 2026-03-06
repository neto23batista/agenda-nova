// services/scheduler.js — Agendador automático de lembretes com node-cron
const cron = require("node-cron");
const { getDb } = require("../database/setup");
const { sendDayReminder } = require("./notificationService");

let schedulerStarted = false;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ── Job: envia lembretes automáticos para todos os agendamentos de hoje ──

async function runDailyReminders() {
  const db   = getDb();
  const today = todayStr();

  console.log(`\n[SCHEDULER] ⏰ Disparando lembretes automáticos — ${today}`);

  const appointments = db.prepare(`
    SELECT a.id, u.name AS client_name
    FROM appointments a
    JOIN users u ON u.id = a.client_id
    WHERE a.date = ?
      AND a.status IN ('confirmed', 'pending')
      AND a.id NOT IN (
        SELECT DISTINCT appointment_id FROM notifications
        WHERE type = 'reminder'
          AND created_at >= date('now', 'start of day')
          AND appointment_id IS NOT NULL
      )
  `).all(today);

  if (appointments.length === 0) {
    console.log(`[SCHEDULER] Nenhum agendamento sem lembrete hoje.`);
    return;
  }

  console.log(`[SCHEDULER] Enviando ${appointments.length} lembrete(s)...`);

  for (const appt of appointments) {
    try {
      await sendDayReminder(appt.id);
    } catch (err) {
      console.error(`[SCHEDULER] ❌ Erro ao enviar lembrete para ${appt.client_name}:`, err.message);
    }
  }

  console.log(`[SCHEDULER] ✅ Lembretes concluídos.\n`);
}

// ── Job: limpeza de notificações antigas (> 30 dias) ─────────

function runCleanup() {
  const db = getDb();
  const deleted = db.prepare(`
    DELETE FROM notifications WHERE created_at < datetime('now', '-30 days')
  `).run();
  if (deleted.changes > 0) {
    console.log(`[SCHEDULER] 🧹 Limpeza: ${deleted.changes} notificações antigas removidas`);
  }
}

// ── Inicializar scheduler ─────────────────────────────────────

function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const reminderCron  = process.env.REMINDER_CRON || "0 8 * * *";
  const cleanupCron   = "0 3 * * 0"; // Domingo às 3h

  // Lembrete diário
  cron.schedule(reminderCron, runDailyReminders, { timezone: "America/Sao_Paulo" });
  console.log(`[SCHEDULER] ✅ Lembrete diário agendado: "${reminderCron}" (America/Sao_Paulo)`);

  // Limpeza semanal
  cron.schedule(cleanupCron, runCleanup, { timezone: "America/Sao_Paulo" });
  console.log(`[SCHEDULER] ✅ Limpeza semanal agendada: "${cleanupCron}"`);
}

module.exports = { startScheduler, runDailyReminders };
