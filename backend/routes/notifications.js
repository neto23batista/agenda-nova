// routes/notifications.js
const express = require("express");
const { getDb }                    = require("../database/setup");
const { authMiddleware, ownerOnly } = require("../middleware/auth");
const { sendManualReminder }        = require("../services/notificationService");
const { runDailyReminders }         = require("../services/scheduler");

const router = express.Router();

// GET /api/notifications
router.get("/", authMiddleware, (req, res) => {
  const db  = getDb();
  const { limit = 40, unreadOnly } = req.query;

  let sql    = "SELECT * FROM notifications WHERE ";
  const params = [];

  if (req.user.role === "owner") {
    sql += "recipient_role = 'owner'";
  } else {
    sql += "recipient_role = 'client' AND recipient_id = ?";
    params.push(req.user.id);
  }

  if (unreadOnly === "true") sql += " AND read = 0";
  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Number(limit));

  const notifications = db.prepare(sql).all(...params);

  const countSql = req.user.role === "owner"
    ? "SELECT COUNT(*) AS n FROM notifications WHERE recipient_role = 'owner' AND read = 0"
    : "SELECT COUNT(*) AS n FROM notifications WHERE recipient_role = 'client' AND recipient_id = ? AND read = 0";
  const countParams = req.user.role === "owner" ? [] : [req.user.id];
  const unreadCount = db.prepare(countSql).get(...countParams).n;

  res.json({ notifications, unreadCount });
});

// PATCH /api/notifications/read-all  (deve vir antes de /:id)
router.patch("/read-all", authMiddleware, (req, res) => {
  const db = getDb();
  if (req.user.role === "owner") {
    db.prepare("UPDATE notifications SET read = 1 WHERE recipient_role = 'owner'").run();
  } else {
    db.prepare("UPDATE notifications SET read = 1 WHERE recipient_id = ?").run(req.user.id);
  }
  res.json({ success: true });
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", authMiddleware, (req, res) => {
  getDb().prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// POST /api/notifications/send-reminder/:appointmentId — envio manual
router.post("/send-reminder/:appointmentId", authMiddleware, ownerOnly, async (req, res) => {
  const { channels = ["email", "whatsapp"] } = req.body;
  try {
    const result = await sendManualReminder(req.params.appointmentId, channels);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/trigger-daily — disparo manual do job (testes)
router.post("/trigger-daily", authMiddleware, ownerOnly, async (req, res) => {
  try {
    await runDailyReminders();
    res.json({ success: true, message: "Lembretes disparados com sucesso" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
