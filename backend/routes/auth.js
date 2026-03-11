const express  = require("express");
const bcrypt   = require("bcryptjs");
const { db }   = require("../database/setup");
const { generateToken, authMiddleware } = require("../middleware/auth");

const router = express.Router();
const uid = () => Math.random().toString(36).slice(2, 11);

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "E-mail e senha são obrigatórios" });

  const user = db.get("users").find({ email, active: true }).value();
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: "E-mail ou senha incorretos" });

  const token = generateToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
});

// POST /api/auth/register
router.post("/register", (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Nome, e-mail e senha obrigatórios" });
  if (password.length < 6) return res.status(400).json({ error: "Senha mínimo 6 caracteres" });
  if (db.get("users").find({ email }).value()) return res.status(409).json({ error: "E-mail já cadastrado" });

  const id   = uid();
  const hash = bcrypt.hashSync(password, 10);
  const user = { id, name, email, phone: phone || "", password: hash, role: "client", active: true, created_at: new Date().toISOString() };
  db.get("users").push(user).write();

  const token = generateToken(user);
  res.status(201).json({ token, user: { id, name, email, phone: phone || "", role: "client" } });
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
  const user = db.get("users").find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ error: "Não encontrado" });
  res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role });
});

module.exports = router;
