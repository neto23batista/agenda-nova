const express  = require("express");
const { db }   = require("../database/setup");
const { authMiddleware, ownerOnly } = require("../middleware/auth");
const router = express.Router();
const uid = () => Math.random().toString(36).slice(2, 11);

router.get("/", authMiddleware, (req, res) => {
  res.json(db.get("services").value().sort((a,b) => a.name.localeCompare(b.name)));
});

router.post("/", authMiddleware, ownerOnly, (req, res) => {
  const { name, icon="💅", duration, price } = req.body;
  if (!name || !duration || !price) return res.status(400).json({ error: "name, duration e price obrigatórios" });
  const svc = { id: uid(), name, icon, duration: Number(duration), price: Number(price), active: true };
  db.get("services").push(svc).write();
  res.status(201).json(svc);
});

router.patch("/:id", authMiddleware, ownerOnly, (req, res) => {
  const { name, icon, duration, price, active } = req.body;
  const update = {};
  if (name     !== undefined) update.name     = name;
  if (icon     !== undefined) update.icon     = icon;
  if (duration !== undefined) update.duration = Number(duration);
  if (price    !== undefined) update.price    = Number(price);
  if (active   !== undefined) update.active   = active;
  db.get("services").find({ id: req.params.id }).assign(update).write();
  res.json(db.get("services").find({ id: req.params.id }).value());
});

module.exports = router;
