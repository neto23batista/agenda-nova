// ═══════════════════════════════════════════════════════════
//  server.js — Belle Studio Backend
//  Express + JSON DB + WhatsApp (Evolution API) + Cron
// ═══════════════════════════════════════════════════════════
'use strict';

require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const { DB }   = require('./db');
const wpp      = require('./whatsapp');
const { startScheduler } = require('./scheduler');

const app  = express();
const PORT = process.env.PORT || 3001;
const PUB  = path.join(__dirname, 'public');

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(PUB));

// ── Helper para tratar erros de rota ────────────────────────
const wrap = fn => (req, res) =>
  Promise.resolve(fn(req, res)).catch(err => {
    console.error(`[${req.method} ${req.path}]`, err.message);
    res.status(err.status || 500).json({ error: err.message });
  });

// ── Rota raiz ────────────────────────────────────────────────
app.get('/', (req, res) => {
  const index = path.join(PUB, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Belle Studio</title>
    <style>
      body{font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px;background:#fdf8f5;color:#1c1917}
      h2{color:#d63371;margin-bottom:8px}
      .box{background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:18px;margin:14px 0}
      code{background:#f0ede8;padding:3px 9px;border-radius:5px;font-size:13px}
      a{color:#d63371}
    </style>
    </head><body>
    <h2>💅 Belle Studio — Backend rodando!</h2>
    <p>API ativa. Falta colocar o frontend na pasta <code>public/</code>.</p>
    <div class="box">
      <b>Como fazer:</b><br><br>
      1. Copie o arquivo <code>belle-studio-v3.html</code><br>
      2. Cole dentro da pasta <code>agenda-nova\\backend\\public\\</code><br>
      3. Renomeie para <code>index.html</code><br>
      4. Recarregue esta página
    </div>
    <p>✅ API funcionando: <a href="/api/services">/api/services</a></p>
  </body></html>`);
});

// ═══════════════════════════════════════════════════════════
//  SERVIÇOS
// ═══════════════════════════════════════════════════════════

// GET /api/services
app.get('/api/services', wrap((req, res) => {
  res.json(DB.getServices());
}));

// PATCH /api/services/:id
app.patch('/api/services/:id', wrap((req, res) => {
  const updated = DB.updateService(req.params.id, req.body);
  res.json(updated);
}));

// ═══════════════════════════════════════════════════════════
//  CLIENTES
// ═══════════════════════════════════════════════════════════

// GET /api/clients
app.get('/api/clients', wrap((req, res) => {
  res.json(DB.getClients());
}));

// POST /api/clients
app.post('/api/clients', wrap((req, res) => {
  const client = DB.createClient(req.body);
  res.status(201).json(client);
}));

// PATCH /api/clients/:id
app.patch('/api/clients/:id', wrap((req, res) => {
  const updated = DB.updateClient(req.params.id, req.body);
  res.json(updated);
}));

// ═══════════════════════════════════════════════════════════
//  AGENDAMENTOS
// ═══════════════════════════════════════════════════════════

// GET /api/appointments
app.get('/api/appointments', wrap((req, res) => {
  const appts = DB.getAppointments({
    clientId: req.query.clientId,
    date:     req.query.date,
    status:   req.query.status,
  });
  res.json(appts);
}));

// POST /api/appointments — cliente solicita agendamento
app.post('/api/appointments', wrap(async (req, res) => {
  const appt = DB.createAppointment(req.body);

  // 🔔 Notifica o dono (não bloqueia a resposta)
  wpp.notifyOwnerNewBooking(appt).catch(console.error);

  res.status(201).json(appt);
}));

// PATCH /api/appointments/:id — dono altera status
app.patch('/api/appointments/:id', wrap(async (req, res) => {
  const { before, after } = DB.updateAppointment(req.params.id, req.body);

  // 🔔 Confirmou? → manda WhatsApp para a cliente
  if (req.body.status === 'confirmed' && before.status !== 'confirmed') {
    console.log(`📲 Confirmado → ${after.clientName} (${after.clientPhone})`);
    wpp.notifyConfirmation(after).catch(console.error);
  }

  res.json(after);
}));

// ═══════════════════════════════════════════════════════════
//  WHATSAPP — TESTE MANUAL
// ═══════════════════════════════════════════════════════════

// POST /api/test-whatsapp  { phone, message }
app.post('/api/test-whatsapp', wrap(async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Informe phone e message' });
  }
  const result = await wpp.sendWhatsApp(phone, message);
  res.json({ ok: true, result });
}));

// ═══════════════════════════════════════════════════════════
//  START
// ═══════════════════════════════════════════════════════════

startScheduler();

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   💅  Belle Studio — Backend iniciado!      ║
╠══════════════════════════════════════════════╣
║  🌐  http://localhost:${PORT}                  ║
║  📦  Banco:     belle-data.json              ║
║  📲  WhatsApp:  ${(process.env.WHATSAPP_PROVIDER||'evolution').padEnd(26)}║
║  ⏰  Lembretes: a cada 30 minutos            ║
╚══════════════════════════════════════════════╝
  `);
});
