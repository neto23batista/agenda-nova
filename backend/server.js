'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { DB } = require('./db');
const wpp = require('./whatsapp');
const { startScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'belle123';
const CORS_ORIGINS = process.env.CORS_ORIGINS;
const ownerTokens = new Set();

app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!CORS_ORIGINS) return callback(null, true);

      const allowed = CORS_ORIGINS.split(',').map(item => item.trim()).filter(Boolean);
      if (allowed.includes(origin)) return callback(null, true);

      return callback(new Error('CORS blocked'));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.static(PUBLIC_DIR, {
  etag: false,
  lastModified: false,
  setHeaders: res => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  },
}));

const validate = (schema, payload) => {
  const { value, error } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map(detail => detail.message).join('; ');
    const err = new Error(message);
    err.status = 400;
    throw err;
  }

  return value;
};

const getOwnerToken = req => {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
};

const requireOwner = (req, res, next) => {
  const token = getOwnerToken(req);
  if (token && ownerTokens.has(token)) return next();
  return res.status(401).json({ error: 'Authorization required' });
};

const wrap = fn => (req, res) =>
  Promise.resolve(fn(req, res)).catch(error => {
    console.error(`[${req.method} ${req.path}]`, error.message);
    res.status(error.status || 500).json({ error: error.message });
  });

const schemas = {
  login: Joi.object({
    password: Joi.string().min(4).required(),
  }),

  clientAccess: Joi.object({
    name: Joi.string().min(2).max(80).required(),
    phone: Joi.string().min(10).max(20).required(),
  }),

  serviceCreate: Joi.object({
    name: Joi.string().min(2).max(80).required(),
    icon: Joi.string().max(8).allow('', null),
    duration: Joi.number().integer().min(10).max(600).required(),
    price: Joi.number().min(0).max(5000).required(),
    active: Joi.boolean().default(true),
  }),

  servicePatch: Joi.object({
    name: Joi.string().min(2).max(80),
    icon: Joi.string().max(8).allow('', null),
    duration: Joi.number().integer().min(10).max(600),
    price: Joi.number().min(0).max(5000),
    active: Joi.boolean(),
  }),

  staffCreate: Joi.object({
    name: Joi.string().min(2).max(80).required(),
    phone: Joi.string().allow('', null),
    color: Joi.string().max(16).allow('', null),
    active: Joi.boolean().default(true),
  }),

  staffPatch: Joi.object({
    name: Joi.string().min(2).max(80),
    phone: Joi.string().allow('', null),
    color: Joi.string().max(16).allow('', null),
    active: Joi.boolean(),
  }),

  clientCreate: Joi.object({
    name: Joi.string().min(2).max(80).required(),
    phone: Joi.string().min(10).max(20).required(),
    email: Joi.string().email().allow('', null),
    notes: Joi.string().max(300).allow('', null),
  }),

  clientPatch: Joi.object({
    name: Joi.string().min(2).max(80),
    phone: Joi.string().min(10).max(20),
    email: Joi.string().email().allow('', null),
    notes: Joi.string().max(300).allow('', null),
  }),

  blockCreate: Joi.object({
    staffId: Joi.string().required(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    start: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    end: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    reason: Joi.string().max(200).allow('', null),
  }),

  appointmentCreate: Joi.object({
    clientId: Joi.string().allow('', null),
    clientName: Joi.string().min(2).max(80).required(),
    clientPhone: Joi.string().min(10).max(20).required(),
    serviceId: Joi.string().required(),
    staffId: Joi.string().allow('', null),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    notes: Joi.string().max(300).allow('', null),
    status: Joi.string().valid('pending', 'confirmed', 'done', 'cancelled').default('pending'),
    paymentStatus: Joi.string().valid('unpaid', 'paid', 'partial').default('unpaid'),
    paymentMethod: Joi.string().max(40).allow('', null),
  }),

  appointmentPatch: Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'done', 'cancelled'),
    notes: Joi.string().max(300).allow('', null),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
    time: Joi.string().pattern(/^\d{2}:\d{2}$/),
    clientName: Joi.string().min(2).max(80),
    clientPhone: Joi.string().min(10).max(20),
    serviceId: Joi.string(),
    staffId: Joi.string(),
    paymentStatus: Joi.string().valid('unpaid', 'paid', 'partial'),
    paymentMethod: Joi.string().max(40).allow('', null),
  }),

  whatsappTest: Joi.object({
    phone: Joi.string().min(10).max(20).required(),
    message: Joi.string().min(1).max(500).required(),
  }),
};

app.get('/', (req, res) => {
  const indexFile = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(indexFile);
  }

  return res.send(`<!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Fernanda Silva Nail Designer</title>
      <style>
        body{font-family:system-ui,sans-serif;max-width:680px;margin:72px auto;padding:24px;background:linear-gradient(180deg,#060506 0%,#100c0e 48%,#090708 100%);color:#f4ece3}
        .card{background:linear-gradient(180deg,rgba(26,18,21,.96),rgba(14,10,12,.94));border:1px solid rgba(210,161,63,.18);border-radius:24px;padding:24px;box-shadow:0 28px 90px rgba(0,0,0,.34)}
        h1{margin:0 0 12px;font-size:28px}
        p{line-height:1.55;color:#b9aca1}
        a{color:#f1ca77}
        code{padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.08);color:#f4ece3}
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Fernanda Silva Nail Designer backend online</h1>
        <p>O backend esta pronto. Publique o frontend compilado dentro de <code>backend/public</code> para servir a interface web.</p>
        <p>API de servicos: <a href="/api/services">/api/services</a></p>
      </div>
    </body>
  </html>`);
});

app.post('/api/login', wrap((req, res) => {
  const { password } = validate(schemas.login, req.body || {});
  if (password !== OWNER_PASSWORD) {
    const error = new Error('Senha incorreta');
    error.status = 401;
    throw error;
  }

  const token = crypto.randomBytes(24).toString('hex');
  ownerTokens.add(token);
  setTimeout(() => ownerTokens.delete(token), 12 * 60 * 60 * 1000);

  res.json({
    token,
    salon: process.env.SALON_NAME || 'Fernanda Silva Nail Designer',
  });
}));

app.post('/api/client-access', wrap((req, res) => {
  const payload = validate(schemas.clientAccess, req.body || {});
  const client = DB.createOrGetClient(payload);
  res.json(client);
}));

app.get('/api/services', wrap((req, res) => {
  const includeInactive = req.query.all === '1';
  res.json(DB.getServices(includeInactive));
}));

app.post('/api/services', requireOwner, wrap((req, res) => {
  const payload = validate(schemas.serviceCreate, req.body || {});
  const service = DB.createService(payload);
  res.status(201).json(service);
}));

app.patch('/api/services/:id', requireOwner, wrap((req, res) => {
  const payload = validate(schemas.servicePatch, req.body || {});
  const service = DB.updateService(req.params.id, payload);
  res.json(service);
}));

app.get('/api/staff', wrap((req, res) => {
  const includeInactive = req.query.all === '1';
  res.json(DB.getStaff(includeInactive));
}));

app.post('/api/staff', requireOwner, wrap((req, res) => {
  const payload = validate(schemas.staffCreate, req.body || {});
  const staff = DB.createStaff(payload);
  res.status(201).json(staff);
}));

app.patch('/api/staff/:id', requireOwner, wrap((req, res) => {
  const payload = validate(schemas.staffPatch, req.body || {});
  const staff = DB.updateStaff(req.params.id, payload);
  res.json(staff);
}));

app.get('/api/blocks', wrap((req, res) => {
  res.json(DB.getBlocks(req.query.staffId));
}));

app.post('/api/blocks', requireOwner, wrap((req, res) => {
  const payload = validate(schemas.blockCreate, req.body || {});
  const block = DB.createBlock(payload);
  res.status(201).json(block);
}));

app.delete('/api/blocks/:id', requireOwner, wrap((req, res) => {
  DB.deleteBlock(req.params.id);
  res.json({ ok: true });
}));

app.get('/api/clients', requireOwner, wrap((req, res) => {
  res.json(DB.getClients());
}));

app.post('/api/clients', requireOwner, wrap((req, res) => {
  const payload = validate(schemas.clientCreate, req.body || {});
  const client = DB.createClient(payload);
  res.status(201).json(client);
}));

app.patch('/api/clients/:id', requireOwner, wrap((req, res) => {
  const payload = validate(schemas.clientPatch, req.body || {});
  const client = DB.updateClient(req.params.id, payload);
  res.json(client);
}));

app.get('/api/appointments', wrap((req, res) => {
  const appointments = DB.getAppointments({
    clientId: req.query.clientId,
    staffId: req.query.staffId,
    date: req.query.date,
    status: req.query.status,
  });
  res.json(appointments);
}));

app.post('/api/appointments', wrap(async (req, res) => {
  const payload = validate(schemas.appointmentCreate, req.body || {});
  const appointment = DB.createAppointment(payload);

  wpp.notifyOwnerNewBooking(appointment).catch(console.error);

  res.status(201).json(appointment);
}));

app.patch('/api/appointments/:id', wrap(async (req, res) => {
  const payload = validate(schemas.appointmentPatch, req.body || {});
  const token = getOwnerToken(req);
  const isOwner = token && ownerTokens.has(token);

  if (!isOwner) {
    const onlyCancel = Object.keys(payload).every(key => key === 'status') && payload.status === 'cancelled';
    if (!onlyCancel) {
      const error = new Error('Authorization required');
      error.status = 401;
      throw error;
    }
  }

  const { before, after } = DB.updateAppointment(req.params.id, payload);

  if (payload.status === 'confirmed' && before.status !== 'confirmed') {
    console.log(`[appointments] confirmation sent to ${after.clientName} (${after.clientPhone})`);
    wpp.notifyConfirmation(after).catch(console.error);
  }

  res.json(after);
}));

app.post('/api/test-whatsapp', requireOwner, wrap(async (req, res) => {
  const { phone, message } = validate(schemas.whatsappTest, req.body || {});
  const result = await wpp.sendWhatsApp(phone, message);
  res.json({ ok: true, result });
}));

startScheduler();

app.listen(PORT, () => {
  console.log(`[server] Fernanda Silva Nail Designer backend running on http://localhost:${PORT}`);
});
