const cron  = require("node-cron");
const { db } = require("../database/setup");
const { sendDayReminder } = require("./notificationService");

let started = false;
const today = () => new Date().toISOString().split("T")[0];

async function runDailyReminders() {
  const t = today();
  console.log(`\n[SCHEDULER] ⏰ Disparando lembretes — ${t}`);

  const sentIds = db.get("notifications")
    .filter(n => n.type === "reminder" && n.created_at >= t)
    .map("appointment_id").value();

  const appts = db.get("appointments")
    .filter(a => a.date === t && ["confirmed","pending"].includes(a.status) && !sentIds.includes(a.id))
    .value();

  if (!appts.length) { console.log("[SCHEDULER] Nenhum agendamento pendente."); return; }
  for (const a of appts) {
    try { await sendDayReminder(a.id); } catch (e) { console.error("[SCHEDULER] Erro:", e.message); }
  }
  console.log(`[SCHEDULER] ✅ ${appts.length} lembrete(s) enviados.\n`);
}

function startScheduler() {
  if (started) return;
  started = true;
  const expr = process.env.REMINDER_CRON || "0 8 * * *";
  cron.schedule(expr, runDailyReminders, { timezone: "America/Sao_Paulo" });
  console.log(`[SCHEDULER] ✅ Lembretes agendados: "${expr}" (America/Sao_Paulo)`);
}

module.exports = { startScheduler, runDailyReminders };
