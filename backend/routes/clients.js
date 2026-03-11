const express  = require("express");
const bcrypt   = require("bcryptjs");
const { db }   = require("../database/setup");
const { authMiddleware, ownerOnly } = require("../middleware/auth");
const router = express.Router();
const uid = () => Math.random().toString(36).slice(2, 11);

router.get("/", authMiddleware, ownerOnly, (req, res) => {
  const { search } = req.query;
  let clients = db.get("users").filter({ role: "client", active: true }).value();
  if (search) {
    const s = search.toLowerCase();
    clients = clients.filter(c => c.name.toLowerCase().includes(s) || c.email.includes(s) || (c.phone||"").includes(s));
  }
  const appts = db.get("appointments").value();
  const svcs  = db.get("services").value();
  const enriched = clients.map(c => {
    const mine = appts.filter(a => a.clientId === c.id && a.status !== "cancelled");
    const visits = mine.length;
    const spent  = mine.reduce((sum, a) => sum + ((svcs.find(s => s.id === a.serviceId) || {}).price || 0), 0);
    const last   = mine.sort((a,b) => b.date.localeCompare(a.date))[0];
    return { id: c.id, name: c.name, email: c.email, phone: c.phone, created_at: c.created_at, visits, spent, lastVisit: last?.date || null };
  });
  res.json(enriched.sort((a,b) => a.name.localeCompare(b.name)));
});

router.post("/", authMiddleware, ownerOnly, (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "name, email e password obrigatórios" });
  if (db.get("users").find({ email }).value()) return res.status(409).json({ error: "E-mail já cadastrado" });
  const id = uid();
  const user = { id, name, email, phone: phone||"", password: bcrypt.hashSync(password,10), role:"client", active:true, created_at: new Date().toISOString() };
  db.get("users").push(user).write();
  res.status(201).json({ id, name, email, phone: phone||"", role:"client" });
});

router.patch("/:id", authMiddleware, ownerOnly, (req, res) => {
  const { name, phone, active } = req.body;
  const update = {};
  if (name   !== undefined) update.name   = name;
  if (phone  !== undefined) update.phone  = phone;
  if (active !== undefined) update.active = active;
  db.get("users").find({ id: req.params.id }).assign(update).write();
  res.json({ success: true });
});

module.exports = router;
