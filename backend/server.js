// server.js — Belle Studio API v2.0
require("dotenv").config();

const express = require("express");
const cors    = require("cors");

// ── Banco: inicializa tabelas antes de qualquer coisa ─────────
const { getDb } = require("./database/setup");
getDb();

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL
    : ["http://localhost:3000", "http://localhost:5173", "http://localhost:4173"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toLocaleTimeString("pt-BR")}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Rotas ─────────────────────────────────────────────────────
app.use("/api/auth",          require("./routes/auth"));
app.use("/api/appointments",  require("./routes/appointments"));
app.use("/api/clients",       require("./routes/clients"));
app.use("/api/services",      require("./routes/services"));
app.use("/api/professionals", require("./routes/professionals"));
app.use("/api/notifications", require("./routes/notifications"));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok", service: "Belle Studio API", version: "2.0.0",
    time: new Date().toISOString(),
    notifications: {
      email:    !!process.env.SMTP_USER,
      whatsapp: process.env.WHATSAPP_PROVIDER || "twilio",
    },
  });
});

app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada" }));
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ error: "Erro interno", detail: err.message });
});

app.listen(PORT, () => {
  console.log(`\n💅 Belle Studio API v2.0 rodando em http://localhost:${PORT}`);
  console.log(`   📧 Email: ${process.env.SMTP_USER ? "✅ configurado" : "⚠️  não configurado"}`);
  console.log(`   📱 WhatsApp: ${process.env.WHATSAPP_PROVIDER || "twilio"}\n`);
  require("./services/scheduler").startScheduler();
});

module.exports = app;
