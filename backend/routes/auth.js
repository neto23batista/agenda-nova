// routes/auth.js — Login e cadastro
const express  = require("express");
const bcrypt   = require("bcryptjs");
const { getDb }        = require("../database/setup");
const { generateToken, authMiddleware } = require("../middleware/auth");

const router = express.Router();
const uid    = () => Math.random().toString(36).slice(2, 11);

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "E-mail e senha são obrigatórios" });

  const db   = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND active = 1").get(email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "E-mail ou senha incorretos" });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
  });
});

// POST /api/auth/register  (clientes)
router.post("/register", (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
  }

  const db = getDb();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    return res.status(409).json({ error: "E-mail já cadastrado" });
  }

  const id   = uid();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(`
    INSERT INTO users (id, name, email, phone, password, role) VALUES (?, ?, ?, ?, ?, 'client')
  `).run(id, name, email, phone || "", hash);

  const user  = { id, name, email, phone: phone || "", role: "client" };
  const token = generateToken(user);
  res.status(201).json({ token, user });
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
  const user = getDb().prepare("SELECT id, name, email, phone, role FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  res.json(user);
});

module.exports = router;
