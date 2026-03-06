// routes/professionals.js
const express = require("express");
const { getDb }                    = require("../database/setup");
const { authMiddleware, ownerOnly } = require("../middleware/auth");

const router = express.Router();
const uid    = () => Math.random().toString(36).slice(2, 11);

// GET /api/professionals
router.get("/", authMiddleware, (req, res) => {
  res.json(getDb().prepare("SELECT * FROM professionals WHERE active = 1 ORDER BY name").all());
});

// POST /api/professionals
router.post("/", authMiddleware, ownerOnly, (req, res) => {
  const { name, specialty, color = "#c9807a" } = req.body;
  if (!name) return res.status(400).json({ error: "name é obrigatório" });
  const id = uid();
  getDb().prepare(
    "INSERT INTO professionals (id, name, specialty, color) VALUES (?, ?, ?, ?)"
  ).run(id, name, specialty || "", color);
  res.status(201).json({ id, name, specialty: specialty || "", color, active: 1 });
});

// PATCH /api/professionals/:id
router.patch("/:id", authMiddleware, ownerOnly, (req, res) => {
  const { name, specialty, color, active } = req.body;
  const db = getDb();
  const fields = [], vals = [];
  if (name      !== undefined) { fields.push("name = ?");      vals.push(name); }
  if (specialty !== undefined) { fields.push("specialty = ?"); vals.push(specialty); }
  if (color     !== undefined) { fields.push("color = ?");     vals.push(color); }
  if (active    !== undefined) { fields.push("active = ?");    vals.push(active ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: "Nada para atualizar" });
  vals.push(req.params.id);
  db.prepare(`UPDATE professionals SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
  res.json(db.prepare("SELECT * FROM professionals WHERE id = ?").get(req.params.id));
});

module.exports = router;
