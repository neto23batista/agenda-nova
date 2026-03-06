// routes/services.js
const express = require("express");
const { getDb }                    = require("../database/setup");
const { authMiddleware, ownerOnly } = require("../middleware/auth");

const router = express.Router();
const uid    = () => Math.random().toString(36).slice(2, 11);

// GET /api/services
router.get("/", authMiddleware, (req, res) => {
  const rows = getDb().prepare("SELECT * FROM services ORDER BY name").all();
  res.json(rows.map(s => ({ ...s, active: !!s.active })));
});

// POST /api/services  (dono cria novo serviço)
router.post("/", authMiddleware, ownerOnly, (req, res) => {
  const { name, icon = "💅", duration, price } = req.body;
  if (!name || !duration || !price)
    return res.status(400).json({ error: "name, duration e price são obrigatórios" });
  const id = uid();
  getDb().prepare(
    "INSERT INTO services (id, name, icon, duration, price) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, icon, Number(duration), Number(price));
  res.status(201).json({ id, name, icon, duration: Number(duration), price: Number(price), active: true });
});

// PATCH /api/services/:id
router.patch("/:id", authMiddleware, ownerOnly, (req, res) => {
  const { name, icon, duration, price, active } = req.body;
  const db = getDb();
  const fields = [], vals = [];
  if (name     !== undefined) { fields.push("name = ?");     vals.push(name); }
  if (icon     !== undefined) { fields.push("icon = ?");     vals.push(icon); }
  if (duration !== undefined) { fields.push("duration = ?"); vals.push(Number(duration)); }
  if (price    !== undefined) { fields.push("price = ?");    vals.push(Number(price)); }
  if (active   !== undefined) { fields.push("active = ?");   vals.push(active ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: "Nada para atualizar" });
  fields.push("updated_at = datetime('now')");
  vals.push(req.params.id);
  db.prepare(`UPDATE services SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
  const updated = db.prepare("SELECT * FROM services WHERE id = ?").get(req.params.id);
  res.json({ ...updated, active: !!updated.active });
});

module.exports = router;
