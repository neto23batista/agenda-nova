// ─────────────────────────────────────────────────────────
//  db.js — Banco de dados em JSON puro (sem compilação!)
//  Usa apenas o módulo 'fs' nativo do Node.js
//  Dados salvos em: belle-data.json
// ─────────────────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'belle-data.json');

// ── Estrutura inicial do banco ───────────────────────────
const EMPTY_DB = {
  services: [
    { id:'s1', name:'Manicure Simples',   icon:'🌸', duration:40, price:45,  active:1 },
    { id:'s2', name:'Pedicure Completa',  icon:'🦶', duration:50, price:60,  active:1 },
    { id:'s3', name:'Gel Alongado',       icon:'💅', duration:90, price:120, active:1 },
    { id:'s4', name:'Esmaltação em Gel',  icon:'✨', duration:60, price:80,  active:1 },
    { id:'s5', name:'Combo Mani + Pedi',  icon:'👑', duration:90, price:95,  active:1 },
  ],
  clients:      [],
  appointments: [],
};

// ── Carrega o banco do disco ──────────────────────────────
function load() {
  try {
    if (fs.existsSync(FILE)) {
      return JSON.parse(fs.readFileSync(FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('⚠️  Erro ao carregar banco, recriando...', e.message);
  }
  return JSON.parse(JSON.stringify(EMPTY_DB)); // deep clone
}

// ── Salva o banco no disco ────────────────────────────────
function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Gera ID único ─────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Retorna data/hora atual em ISO ────────────────────────
function now() {
  return new Date().toISOString();
}

// ══════════════════════════════════════════════════════════
//  API do banco — idêntica ao que o server.js usa
// ══════════════════════════════════════════════════════════

const DB = {

  // ── SERVICES ──────────────────────────────────────────

  getServices() {
    const data = load();
    return data.services.filter(s => s.active);
  },

  updateService(id, patch) {
    const data = load();
    data.services = data.services.map(s =>
      s.id === id ? { ...s, ...patch } : s
    );
    save(data);
    return data.services;
  },

  // ── CLIENTS ───────────────────────────────────────────

  getClients() {
    const data = load();
    return [...data.clients].sort((a, b) => a.name.localeCompare(b.name));
  },

  createClient({ name, phone, email, notes }) {
    if (!name?.trim()) throw new Error('Nome obrigatório');
    if (!phone?.trim()) throw new Error('Telefone obrigatório');
    const data   = load();
    const client = { id: 'c' + uid(), name: name.trim(), phone: phone.trim(), email: email || '', notes: notes || '', created_at: now() };
    data.clients.push(client);
    save(data);
    return client;
  },

  updateClient(id, patch) {
    const data = load();
    const idx  = data.clients.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Cliente não encontrada');
    data.clients[idx] = { ...data.clients[idx], ...patch, updated_at: now() };
    save(data);
    return data.clients[idx];
  },

  // ── APPOINTMENTS ──────────────────────────────────────

  getAppointments({ clientId, date, status } = {}) {
    const data = load();
    let list   = data.appointments;
    if (clientId) list = list.filter(a => a.client_id === clientId);
    if (date)     list = list.filter(a => a.date === date);
    if (status)   list = list.filter(a => a.status === status);
    return list.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  },

  createAppointment({ clientId, clientName, clientPhone, serviceId, date, time, notes, status }) {
    const data = load();

    // Verifica conflito de horário
    const conflict = data.appointments.find(
      a => a.date === date && a.time === time && a.status !== 'cancelled'
    );
    if (conflict) throw new Error('Horário já ocupado');

    const svc   = data.services.find(s => s.id === serviceId) || {};
    const appt  = {
      id:            'a' + uid(),
      client_id:     clientId  || null,
      clientName:    clientName || 'Cliente',
      clientPhone:   clientPhone || '',
      serviceId,
      serviceName:   svc.name     || '',
      serviceIcon:   svc.icon     || '',
      servicePrice:  svc.price    || 0,
      serviceDuration: svc.duration || 0,
      date,
      time,
      status:        status || 'pending',
      notes:         notes  || '',
      reminded_day:  false,
      reminded_hour: false,
      created_at:    now(),
    };

    data.appointments.push(appt);
    save(data);
    return appt;
  },

  updateAppointment(id, patch) {
    const data = load();
    const idx  = data.appointments.findIndex(a => a.id === id);
    if (idx === -1) throw new Error('Agendamento não encontrado');

    const old  = data.appointments[idx];
    data.appointments[idx] = { ...old, ...patch, updated_at: now() };
    save(data);
    return { old, updated: data.appointments[idx] };
  },

  // Retorna agendamentos confirmados a partir de uma data (para o scheduler)
  getConfirmedFrom(dateStr) {
    const data = load();
    return data.appointments.filter(
      a => a.status === 'confirmed' && a.date >= dateStr
    );
  },

  markRemindedDay(id) {
    const data = load();
    const idx  = data.appointments.findIndex(a => a.id === id);
    if (idx !== -1) { data.appointments[idx].reminded_day = true; save(data); }
  },

  markRemindedHour(id) {
    const data = load();
    const idx  = data.appointments.findIndex(a => a.id === id);
    if (idx !== -1) { data.appointments[idx].reminded_hour = true; save(data); }
  },
};

module.exports = { DB, uid, now };
