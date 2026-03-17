// ═══════════════════════════════════════════════════════════
//  db.js — Banco de dados em memória + persistência em JSON
//
//  Estratégia eficiente:
//  - Dados ficam em memória (acesso instantâneo)
//  - Salvos em disco só quando há mudança
//  - Backup automático a cada hora
// ═══════════════════════════════════════════════════════════
'use strict';

const fs   = require('fs');
const path = require('path');

const FILE        = path.join(__dirname, 'belle-data.json');
const BACKUP_FILE = path.join(__dirname, 'belle-data.backup.json');

// ── Seed de serviços padrão ─────────────────────────────────
const DEFAULT_SERVICES = [
  { id:'s1', name:'Manicure Simples',   icon:'🌸', duration:40,  price:45,  active:true },
  { id:'s2', name:'Pedicure Completa',  icon:'🦶', duration:50,  price:60,  active:true },
  { id:'s3', name:'Gel Alongado',       icon:'💅', duration:90,  price:120, active:true },
  { id:'s4', name:'Esmaltação em Gel',  icon:'✨', duration:60,  price:80,  active:true },
  { id:'s5', name:'Combo Mani + Pedi',  icon:'👑', duration:90,  price:95,  active:true },
];

// ── Helpers ─────────────────────────────────────────────────
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const now  = () => new Date().toISOString();
const pad  = n  => String(n).padStart(2, '0');

// ── Carrega banco do disco na inicialização ──────────────────
function loadFromDisk() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, 'utf8');
      const data = JSON.parse(raw);
      console.log(`📂 Banco carregado: ${data.appointments?.length || 0} agendamentos, ${data.clients?.length || 0} clientes.`);
      return data;
    }
  } catch (e) {
    console.warn('⚠️  Erro ao ler banco, iniciando do zero:', e.message);
    // Tenta carregar o backup
    try {
      if (fs.existsSync(BACKUP_FILE)) {
        const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
        console.log('♻️  Banco restaurado do backup!');
        return JSON.parse(raw);
      }
    } catch (_) {}
  }
  console.log('🌱 Banco novo criado com serviços padrão.');
  return { services: DEFAULT_SERVICES, clients: [], appointments: [] };
}

// ── Estado global em memória ─────────────────────────────────
const _db = loadFromDisk();

// ── Salva no disco (com backup automático) ───────────────────
function persist() {
  try {
    const json = JSON.stringify(_db, null, 2);
    // Salva arquivo principal
    fs.writeFileSync(FILE, json, 'utf8');
  } catch (e) {
    console.error('❌ Erro ao salvar banco:', e.message);
  }
}

// Backup a cada 1 hora
setInterval(() => {
  try {
    if (fs.existsSync(FILE)) {
      fs.copyFileSync(FILE, BACKUP_FILE);
    }
  } catch (e) {
    console.warn('⚠️  Erro no backup:', e.message);
  }
}, 60 * 60 * 1000);

// ═══════════════════════════════════════════════════════════
//  API DO BANCO
// ═══════════════════════════════════════════════════════════
const DB = {

  // ── SERVICES ─────────────────────────────────────────────

  getServices() {
    return _db.services.filter(s => s.active);
  },

  updateService(id, { name, icon, duration, price }) {
    const svc = _db.services.find(s => s.id === id);
    if (!svc) throw new Error(`Serviço ${id} não encontrado`);
    if (name)                  svc.name     = String(name).trim();
    if (icon)                  svc.icon     = String(icon).trim();
    if (duration !== undefined) svc.duration = Number(duration);
    if (price    !== undefined) svc.price    = Number(price);
    persist();
    return _db.services;
  },

  // ── CLIENTS ───────────────────────────────────────────────

  getClients() {
    return [..._db.clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  },

  createClient({ name, phone, email = '', notes = '' }) {
    name  = name?.trim();
    phone = phone?.trim();
    if (!name)  throw new Error('Nome é obrigatório');
    if (!phone) throw new Error('Telefone é obrigatório');

    const client = { id: 'c' + uid(), name, phone, email, notes, created_at: now() };
    _db.clients.push(client);
    persist();
    return client;
  },

  updateClient(id, patch) {
    const idx = _db.clients.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Cliente não encontrada');
    const allowed = ['name', 'phone', 'email', 'notes'];
    allowed.forEach(k => { if (patch[k] !== undefined) _db.clients[idx][k] = patch[k]; });
    _db.clients[idx].updated_at = now();
    persist();
    return _db.clients[idx];
  },

  // ── APPOINTMENTS ──────────────────────────────────────────

  getAppointments({ clientId, date, status } = {}) {
    let list = _db.appointments;
    if (clientId) list = list.filter(a => a.client_id === clientId);
    if (date)     list = list.filter(a => a.date      === date);
    if (status)   list = list.filter(a => a.status    === status);
    // Ordena por data e hora (mais recente primeiro quando passado)
    return [...list].sort((a, b) =>
      a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
    );
  },

  createAppointment({ clientId, clientName, clientPhone, serviceId, date, time, notes = '', status = 'pending' }) {
    if (!date || !time || !serviceId) throw new Error('date, time e serviceId são obrigatórios');

    // Checa conflito de horário
    const busy = _db.appointments.find(
      a => a.date === date && a.time === time && a.status !== 'cancelled'
    );
    if (busy) throw new Error('Horário já ocupado');

    const svc  = _db.services.find(s => s.id === serviceId) || {};
    const appt = {
      id:              'a' + uid(),
      client_id:       clientId    || null,
      clientName:      clientName  || 'Cliente',
      clientPhone:     clientPhone || '',
      serviceId,
      serviceName:     svc.name     || '',
      serviceIcon:     svc.icon     || '',
      servicePrice:    svc.price    || 0,
      serviceDuration: svc.duration || 0,
      date,
      time,
      status,
      notes,
      reminded_day:    false,
      reminded_hour:   false,
      created_at:      now(),
    };

    _db.appointments.push(appt);
    persist();
    return appt;
  },

  updateAppointment(id, patch) {
    const idx = _db.appointments.findIndex(a => a.id === id);
    if (idx === -1) throw new Error('Agendamento não encontrado');

    const before = { ..._db.appointments[idx] };
    const allowed = ['status', 'notes', 'date', 'time', 'clientName', 'clientPhone', 'serviceId'];
    allowed.forEach(k => { if (patch[k] !== undefined) _db.appointments[idx][k] = patch[k]; });
    _db.appointments[idx].updated_at = now();
    persist();

    return { before, after: _db.appointments[idx] };
  },

  // Para o scheduler — agendamentos confirmados a partir de hoje
  getConfirmedFrom(dateStr) {
    return _db.appointments.filter(
      a => a.status === 'confirmed' && a.date >= dateStr
    );
  },

  markReminded(id, type) {
    // type: 'day' | 'hour'
    const appt = _db.appointments.find(a => a.id === id);
    if (appt) {
      appt[`reminded_${type}`] = true;
      persist();
    }
  },
};

module.exports = { DB };
