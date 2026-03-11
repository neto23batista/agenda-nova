const express  = require("express");
const { db }   = require("../database/setup");
const { authMiddleware, ownerOnly } = require("../middleware/auth");
const { sendManualReminder } = require("../services/notificationService");
const { runDailyReminders }  = require("../services/scheduler");
const router = express.Router();

router.get("/", authMiddleware, (req, res) => {
  const limit = Number(req.query.limit) || 40;
  let notifs = db.get("notifications").value();

  if (req.user.role === "owner") {
    notifs = notifs.filter(n => n.recipient_role === "owner");
  } else {
    notifs = notifs.filter(n => n.recipient_role === "client" && n.recipient_id === req.user.id);
  }

  notifs.sort((a,b) => b.created_at.localeCompare(a.created_at));
  const unreadCount = notifs.filter(n => !n.read).length;
  res.json({ notifications: notifs.slice(0, limit), unreadCount });
});

router.patch("/read-all", authMiddleware, (req, res) => {
  const notifs = db.get("notifications").value();
  notifs.forEach(n => {
    const mine = req.user.role === "owner" ? n.recipient_role === "owner" : n.recipient_id === req.user.id;
    if (mine) db.get("notifications").find({ id: n.id }).assign({ read: true }).write();
  });
  res.json({ success: true });
});

router.patch("/:id/read", authMiddleware, (req, res) => {
  db.get("notifications").find({ id: req.params.id }).assign({ read: true }).write();
  res.json({ success: true });
});

router.post("/send-reminder/:apptId", authMiddleware, ownerOnly, async (req, res) => {
  const { channels = ["email", "whatsapp"] } = req.body;
  try {
    const result = await sendManualReminder(req.params.apptId, channels);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/trigger-daily", authMiddleware, ownerOnly, async (req, res) => {
  try { await runDailyReminders(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
