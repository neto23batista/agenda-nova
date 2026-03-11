const express  = require("express");
const { db }   = require("../database/setup");
const { authMiddleware, ownerOnly } = require("../middleware/auth");
const router = express.Router();
const uid = () => Math.random().toString(36).slice(2, 11);

router.get("/", authMiddleware, (req, res) => {
  res.json(db.get("professionals").filter({ active: true }).value().sort((a,b) => a.name.localeCompare(b.name)));
});

router.post("/", authMiddleware, ownerOnly, (req, res) => {
  const { name, specialty, color="#c9807a" } = req.body;
  if (!name) return res.status(400).json({ error: "name obrigatório" });
  const p = { id: uid(), name, specialty: specialty||"", color, active: true };
  db.get("professionals").push(p).write();
  res.status(201).json(p);
});

router.patch("/:id", authMiddleware, ownerOnly, (req, res) => {
  const { name, specialty, color, active } = req.body;
  const update = {};
  if (name      !== undefined) update.name      = name;
  if (specialty !== undefined) update.specialty = specialty;
  if (color     !== undefined) update.color     = color;
  if (active    !== undefined) update.active    = active;
  db.get("professionals").find({ id: req.params.id }).assign(update).write();
  res.json(db.get("professionals").find({ id: req.params.id }).value());
});

module.exports = router;
