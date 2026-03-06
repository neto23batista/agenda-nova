// middleware/auth.js — Middleware de autenticação JWT
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_insecure";

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }
  try {
    const token   = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user      = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

function ownerOnly(req, res, next) {
  if (req.user?.role !== "owner") {
    return res.status(403).json({ error: "Acesso restrito à proprietária" });
  }
  next();
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

module.exports = { authMiddleware, ownerOnly, generateToken };
