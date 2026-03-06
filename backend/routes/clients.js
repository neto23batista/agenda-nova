// routes/clients.js
const express = require("express");
const bcrypt  = require("bcryptjs");
const { getDb }                    = require("../database/setup");
const { authMiddleware, ownerOnly } = require("../middleware/auth");

const router = express.Router();
const uid    = () => Math.random().toString(36).slice(2, 11);

// GET /api/clients
router.get("/", authMiddleware, ownerOnly, (req, res) => {
  const { search } = req.query;
  const db = getDb();

  let sql    = "SELECT id, name, email, phone, created_at FROM users WHERE role = 'client' AND active = 1";
  const params = [];
  if (search) {
    sql += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)";
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  sql += " ORDER BY name";

  const clients = db.prepare(sql).all(...params).map(c => {
    const visits = db.prepare(
      "SELECT COUNT(*) AS n FROM appointments WHERE client_id = ? AND status != 'cancelled'"
    ).get(c.id).n;

    const spent = db.prepare(
      "SELECT COALESCE(SUM(s.price),0) AS total FROM appointments a JOIN services s ON s.id = a.service_id WHERE a.client_id = ? AND a.status != 'cancelled'"
    ).get(c.id).total;

    const last = db.prepare(
      "SELECT date FROM appointments WHERE client_id = ? ORDER BY date DESC LIMIT 1"
    ).get(c.id);

    return { ...c, visits, spent, lastVisit: last?.date || null };
  });

  res.json(clients);
});

// POST /api/clients
router.post("/", authMiddleware, ownerOnly, (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "name, email e password são obrigatórios" });

  const db = getDb();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email))
    return res.status(409).json({ error: "E-mail já cadastrado" });

  const id   = uid();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    "INSERT INTO users (id, name, email, phone, password, role) VALUES (?, ?, ?, ?, ?, 'client')"
  ).run(id, name, email, phone || "", hash);

  res.status(201).json({ id, name, email, phone: phone || "", role: "client" });
});

// PATCH /api/clients/:id
router.patch("/:id", authMiddleware, ownerOnly, (req, res) => {
  const { name, phone, active } = req.body;
  const db = getDb();
  const fields = [], vals = [];
  if (name   !== undefined) { fields.push("name = ?");   vals.push(name); }
  if (phone  !== undefined) { fields.push("phone = ?");  vals.push(phone); }
  if (active !== undefined) { fields.push("active = ?"); vals.push(active ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: "Nada para atualizar" });
  fields.push("updated_at = datetime('now')");
  vals.push(req.params.id);
  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
  res.json({ success: true });
});

module.exports = router;
