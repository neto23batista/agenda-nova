// ─────────────────────────────────────────────────────────
//  server.js — Belle Studio Backend
//  Express + JSON DB (sem compilação!) + WhatsApp + Cron
// ─────────────────────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { DB }  = require('./db');
const {
  notifyConfirmation,
  notifyOwnerNewBooking,
} = require('./whatsapp');
const { startScheduler } = require('./scheduler');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve o frontend (coloque belle-studio-v3.html aqui)
app.use(express.static(path.join(__dirname, 'public')));

// ── Rota raiz — redireciona para o frontend ─────────────
const fs = require('fs');
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  // Instrução amigável se o HTML não foi copiado ainda
  res.send(`
    <html><head><meta charset="UTF-8">
    <style>body{font-family:sans-serif;max-width:600px;margin:60px auto;padding:20px;background:#fdf8f5}
    h2{color:#d63371}code{background:#f0ede8;padding:4px 10px;border-radius:6px;font-size:14px}
    .step{margin:16px 0;padding:16px;background:#fff;border-radius:12px;border:1px solid #e7e5e4}
    </style></head><body>
    <h2>💅 Belle Studio — Backend rodando!</h2>
    <p>O servidor está funcionando. Agora coloque o frontend:</p>
    <div class="step">
      <b>Passo 1:</b> Crie a pasta <code>public</code> dentro de <code>belle-studio-backend</code>
    </div>
    <div class="step">
      <b>Passo 2:</b> Copie o arquivo <code>belle-studio-v3.html</code> para dentro de <code>public/</code>
      e renomeie para <code>index.html</code>
    </div>
    <div class="step">
      <b>Passo 3:</b> Acesse novamente <a href="/">http://localhost:3001</a>
    </div>
    <hr style="margin:24px 0;border:1px solid #f0ede8">
    <p>✅ API funcionando em: <a href="/api/services">/api/services</a></p>
    </body></html>
  `);
});

// ══════════════════════════════════════════════════════════
//  ROTAS — SERVIÇOS
// ══════════════════════════════════════════════════════════

// GET /api/services
app.get('/api/services', (req, res) => {
  try {
    res.json(DB.getServices());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/services/:id
app.patch('/api/services/:id', (req, res) => {
  try {
    const updated = DB.updateService(req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════
//  ROTAS — CLIENTES
// ══════════════════════════════════════════════════════════

// GET /api/clients
app.get('/api/clients', (req, res) => {
  try {
    res.json(DB.getClients());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/clients
app.post('/api/clients', (req, res) => {
  try {
    const client = DB.createClient(req.body);
    res.status(201).json(client);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PATCH /api/clients/:id
app.patch('/api/clients/:id', (req, res) => {
  try {
    const updated = DB.updateClient(req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════
//  ROTAS — AGENDAMENTOS
// ══════════════════════════════════════════════════════════

// GET /api/appointments
app.get('/api/appointments', (req, res) => {
  try {
    const appts = DB.getAppointments({
      clientId: req.query.clientId,
      date:     req.query.date,
      status:   req.query.status,
    });
    res.json(appts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/appointments — cliente cria agendamento
app.post('/api/appointments', async (req, res) => {
  try {
    const { clientId, clientName, clientPhone, serviceId, date, time, notes, status } = req.body;

    if (!date || !time || !serviceId) {
      return res.status(400).json({ error: 'date, time e serviceId são obrigatórios' });
    }

    const appt = DB.createAppointment({ clientId, clientName, clientPhone, serviceId, date, time, notes, status });

    // 🔔 Notifica o DONO sobre novo agendamento
    notifyOwnerNewBooking(appt).catch(console.error);

    res.status(201).json(appt);
  } catch (e) {
    const code = e.message === 'Horário já ocupado' ? 409 : 400;
    res.status(code).json({ error: e.message });
  }
});

// PATCH /api/appointments/:id — dono confirma / cancela / conclui
app.patch('/api/appointments/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const { old, updated }  = DB.updateAppointment(req.params.id, { status, notes });

    // 🔔 Envia WhatsApp de confirmação para a CLIENTE
    if (status === 'confirmed' && old.status !== 'confirmed') {
      console.log(`📲 Confirmando → enviando WhatsApp para ${updated.clientName} (${updated.clientPhone})`);
      notifyConfirmation(updated).catch(console.error);
    }

    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════
//  ROTA — TESTE DE WHATSAPP
// ══════════════════════════════════════════════════════════
app.post('/api/test-whatsapp', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'phone e message são obrigatórios' });
  }
  const { sendWhatsApp } = require('./whatsapp');
  const result = await sendWhatsApp(phone, message);
  res.json({ ok: true, result });
});

// ══════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ══════════════════════════════════════════════════════════
startScheduler();

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   💅 Belle Studio — Backend Online      ║
  ║   http://localhost:${PORT}                 ║
  ╚══════════════════════════════════════════╝

  📦 Banco:     belle-data.json (sem compilação!)
  📲 WhatsApp:  ${process.env.WHATSAPP_PROVIDER || 'evolution'}
  ⏰ Lembretes: ativos (a cada 30 min)
  🌐 Frontend:  http://localhost:${PORT}
  `);
});
