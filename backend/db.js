'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, 'belle-data.json');
const BACKUP_FILE = path.join(__dirname, 'belle-data.backup.json');
const TEMP_FILE = `${FILE}.tmp`;
const SINGLE_PROFESSIONAL_MODE = true;

const DEFAULT_SERVICES = [
  { id: 's1', name: 'Manicure Premium', icon: 'MN', duration: 40, price: 45, active: true },
  { id: 's2', name: 'Pedicure Spa', icon: 'PD', duration: 50, price: 60, active: true },
  { id: 's3', name: 'Gel Alongado', icon: 'GL', duration: 90, price: 120, active: true },
  { id: 's4', name: 'Esmaltacao em Gel', icon: 'EG', duration: 60, price: 80, active: true },
  { id: 's5', name: 'Combo Mani e Pedi', icon: 'CB', duration: 90, price: 95, active: true },
];

const DEFAULT_STAFF = [
  { id: 'p1', name: 'Profissional Principal', phone: '', color: '#df6f4b', active: true },
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const now = () => new Date().toISOString();
const timeToMin = value => {
  const [hours, minutes] = String(value || '0:0').split(':').map(Number);
  return (hours * 60) + minutes;
};
const normalizePhone = value => String(value || '').replace(/\D/g, '');
const hashPassword = password => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
};
const verifyPassword = (password, salt, hash) => {
  if (!salt || !hash) return false;
  const incoming = crypto.scryptSync(String(password), salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (incoming.length !== stored.length) return false;
  return crypto.timingSafeEqual(incoming, stored);
};
const toPublicClient = client => ({
  id: client.id,
  name: client.name,
  phone: client.phone,
  email: client.email || '',
  notes: client.notes || '',
  created_at: client.created_at,
  updated_at: client.updated_at,
});

function loadFromDisk() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, 'utf8');
      const data = JSON.parse(raw);
      console.log(
        `[db] loaded ${data.appointments?.length || 0} appointments and ${data.clients?.length || 0} clients.`,
      );
      return data;
    }
  } catch (error) {
    console.warn('[db] failed to read primary file, trying backup:', error.message);
    try {
      if (fs.existsSync(BACKUP_FILE)) {
        const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
        console.log('[db] restored from backup file.');
        return JSON.parse(raw);
      }
    } catch (backupError) {
      console.warn('[db] failed to read backup file:', backupError.message);
    }
  }

  console.log('[db] creating a new database with default services.');
  return {
    services: DEFAULT_SERVICES,
    staff: DEFAULT_STAFF,
    clients: [],
    appointments: [],
    blocks: [],
  };
}

const db = loadFromDisk();
db.services = Array.isArray(db.services) && db.services.length ? db.services : DEFAULT_SERVICES;
db.staff = Array.isArray(db.staff) && db.staff.length ? db.staff : DEFAULT_STAFF;
db.clients = Array.isArray(db.clients) ? db.clients : [];
db.appointments = Array.isArray(db.appointments) ? db.appointments : [];
db.blocks = Array.isArray(db.blocks) ? db.blocks : [];

function enforceSingleProfessionalMode() {
  if (!SINGLE_PROFESSIONAL_MODE) return false;
  if (!Array.isArray(db.staff) || !db.staff.length) {
    db.staff = [...DEFAULT_STAFF];
    return true;
  }

  let changed = false;
  let activeIndex = db.staff.findIndex(item => item.active !== false);
  if (activeIndex === -1) activeIndex = 0;

  db.staff = db.staff.map((item, index) => {
    const next = { ...item, active: index === activeIndex };
    if (!!item.active !== next.active) changed = true;
    return next;
  });

  return changed;
}

function persist() {
  try {
    const payload = JSON.stringify(db, null, 2);
    fs.writeFileSync(TEMP_FILE, payload, 'utf8');
    fs.renameSync(TEMP_FILE, FILE);
  } catch (error) {
    console.error('[db] failed to persist database:', error.message);
    try {
      if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE);
    } catch (cleanupError) {
      console.warn('[db] failed to cleanup temp file:', cleanupError.message);
    }
  }
}

setInterval(() => {
  try {
    if (fs.existsSync(FILE)) {
      fs.copyFileSync(FILE, BACKUP_FILE);
    }
  } catch (error) {
    console.warn('[db] failed to create backup:', error.message);
  }
}, 60 * 60 * 1000);

if (enforceSingleProfessionalMode()) {
  persist();
}

const setPrimaryStaff = id => {
  db.staff.forEach(item => {
    item.active = item.id === id;
    item.updated_at = now();
  });
};

const DB = {
  getServices(includeInactive = false) {
    const list = includeInactive ? db.services : db.services.filter(service => service.active !== false);
    return [...list].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  },

  createService({ name, icon = '', duration, price, active = true }) {
    if (!name?.trim()) throw new Error('Nome do servico e obrigatorio');

    const service = {
      id: 's' + uid(),
      name: name.trim(),
      icon: String(icon || '').trim().slice(0, 8),
      duration: Number(duration) || 0,
      price: Number(price) || 0,
      active: !!active,
      created_at: now(),
    };

    db.services.push(service);
    persist();
    return service;
  },

  updateService(id, patch) {
    const service = db.services.find(item => item.id === id);
    if (!service) throw new Error(`Servico ${id} nao encontrado`);

    if (patch.name !== undefined) service.name = String(patch.name).trim();
    if (patch.icon !== undefined) service.icon = String(patch.icon).trim();
    if (patch.duration !== undefined) service.duration = Number(patch.duration);
    if (patch.price !== undefined) service.price = Number(patch.price);
    if (patch.active !== undefined) service.active = !!patch.active;
    service.updated_at = now();

    persist();
    return service;
  },

  getStaff(includeInactive = false) {
    const list = includeInactive ? db.staff : db.staff.filter(item => item.active !== false);
    return [...list].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  },

  createStaff({ name, phone = '', color = '#df6f4b', active = true }) {
    if (!name?.trim()) throw new Error('Nome da profissional e obrigatorio');

    const shouldActivate = db.staff.length === 0 ? true : !!active;
    if (SINGLE_PROFESSIONAL_MODE && shouldActivate) {
      setPrimaryStaff('__none__');
    }

    const staff = {
      id: 'p' + uid(),
      name: name.trim(),
      phone,
      color,
      active: shouldActivate,
      created_at: now(),
    };

    db.staff.push(staff);
    if (SINGLE_PROFESSIONAL_MODE && shouldActivate) {
      setPrimaryStaff(staff.id);
    }
    persist();
    return staff;
  },

  updateStaff(id, patch) {
    const staff = db.staff.find(item => item.id === id);
    if (!staff) throw new Error('Profissional nao encontrada');

    ['name', 'phone', 'color', 'active'].forEach(key => {
      if (patch[key] !== undefined) {
        staff[key] = patch[key];
      }
    });

    if (SINGLE_PROFESSIONAL_MODE) {
      if (patch.active === true) {
        setPrimaryStaff(staff.id);
      } else if (patch.active === false) {
        const fallback = db.staff.find(item => item.id !== id) || staff;
        setPrimaryStaff(fallback.id);
      }
    }
    staff.updated_at = now();

    persist();
    return staff;
  },

  getClients() {
    return [...db.clients]
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
      .map(toPublicClient);
  },

  findClientByPhone(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return db.clients.find(client => normalizePhone(client.phone) === normalized) || null;
  },

  createOrGetClient({ name, phone }) {
    const existing = this.findClientByPhone(phone);
    if (existing) {
      if (name?.trim() && existing.name !== name.trim()) {
        existing.name = name.trim();
        existing.updated_at = now();
        persist();
      }
      return toPublicClient(existing);
    }

    return this.createClient({
      name,
      phone,
      email: '',
      notes: '',
    });
  },

  createClient({ name, phone, email = '', notes = '' }) {
    if (!name?.trim()) throw new Error('Nome e obrigatorio');
    if (!phone?.trim()) throw new Error('Telefone e obrigatorio');
    if (this.findClientByPhone(phone)) throw new Error('Ja existe cliente com este telefone');

    const client = {
      id: 'c' + uid(),
      name: name.trim(),
      phone: phone.trim(),
      email,
      notes,
      created_at: now(),
    };

    db.clients.push(client);
    persist();
    return toPublicClient(client);
  },

  updateClient(id, patch) {
    const client = db.clients.find(item => item.id === id);
    if (!client) throw new Error('Cliente nao encontrado');

    if (patch.phone !== undefined) {
      const conflict = db.clients.find(item => item.id !== id && normalizePhone(item.phone) === normalizePhone(patch.phone));
      if (conflict) throw new Error('Ja existe cliente com este telefone');
    }

    ['name', 'phone', 'email', 'notes'].forEach(key => {
      if (patch[key] !== undefined) {
        client[key] = patch[key];
      }
    });
    client.updated_at = now();

    persist();
    return toPublicClient(client);
  },

  registerClientAccount({ name, phone, password }) {
    const normalizedPhone = normalizePhone(phone);
    if (!name?.trim()) throw new Error('Nome e obrigatorio');
    if (!normalizedPhone) throw new Error('Telefone e obrigatorio');
    if (!password || String(password).length < 4) throw new Error('Senha invalida');

    let client = this.findClientByPhone(normalizedPhone);
    if (client && client.passwordHash) {
      throw new Error('Ja existe uma conta com este WhatsApp');
    }

    const credentials = hashPassword(password);

    if (client) {
      client.name = name.trim();
      client.phone = normalizedPhone;
      client.passwordSalt = credentials.salt;
      client.passwordHash = credentials.hash;
      client.updated_at = now();
      persist();
      return toPublicClient(client);
    }

    const record = {
      id: 'c' + uid(),
      name: name.trim(),
      phone: normalizedPhone,
      email: '',
      notes: '',
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
      created_at: now(),
    };

    db.clients.push(record);
    persist();
    return toPublicClient(record);
  },

  authenticateClientAccount({ phone, password }) {
    const client = this.findClientByPhone(phone);
    if (!client || !client.passwordHash || !verifyPassword(password, client.passwordSalt, client.passwordHash)) {
      throw new Error('WhatsApp ou senha incorretos');
    }

    return toPublicClient(client);
  },

  getBlocks(staffId) {
    return db.blocks.filter(block => !staffId || block.staffId === staffId);
  },

  createBlock({ staffId, date, start, end, reason = '' }) {
    if (!staffId || !date || !start || !end) {
      throw new Error('staffId, date, start e end sao obrigatorios');
    }

    const staff = db.staff.find(item => item.id === staffId && item.active !== false);
    if (!staff) throw new Error('Profissional invalida');

    const startMin = timeToMin(start);
    const endMin = timeToMin(end);
    if (endMin <= startMin) throw new Error('Horario invalido');

    const conflict = db.blocks.find(block =>
      block.staffId === staffId &&
      block.date === date &&
      !(timeToMin(block.end) <= startMin || timeToMin(block.start) >= endMin)
    );

    if (conflict) throw new Error('Ja existe bloqueio neste periodo');

    const block = {
      id: 'b' + uid(),
      staffId,
      date,
      start,
      end,
      reason,
      created_at: now(),
    };

    db.blocks.push(block);
    persist();
    return block;
  },

  deleteBlock(id) {
    const index = db.blocks.findIndex(block => block.id === id);
    if (index > -1) {
      db.blocks.splice(index, 1);
      persist();
    }
  },

  getAppointments({ clientId, date, status, staffId } = {}) {
    let list = db.appointments;

    if (clientId) {
      list = list.filter(item => item.client_id === clientId || item.clientId === clientId);
    }
    if (staffId) {
      list = list.filter(item => item.staffId === staffId);
    }
    if (date) {
      list = list.filter(item => item.date === date);
    }
    if (status) {
      list = list.filter(item => item.status === status);
    }

    return [...list].sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time));
  },

  getAppointmentById(id) {
    return db.appointments.find(item => item.id === id) || null;
  },

  createAppointment({
    clientId,
    clientName,
    clientPhone,
    serviceId,
    staffId,
    date,
    time,
    notes = '',
    status = 'pending',
    paymentStatus = 'unpaid',
    paymentMethod = '',
  }) {
    if (!date || !time || !serviceId) throw new Error('date, time e serviceId sao obrigatorios');

    const service = db.services.find(item => item.id === serviceId);
    if (!service) throw new Error('Servico nao encontrado');
    if (service.active === false) throw new Error('Servico inativo');

    const staff = staffId
      ? db.staff.find(item => item.id === staffId && item.active !== false)
      : db.staff.find(item => item.active !== false);
    if (!staff) throw new Error('Profissional nao disponivel');

    const slotStart = timeToMin(time);
    const slotEnd = slotStart + (service.duration || 60);

    const busy = db.appointments.find(item =>
      item.staffId === staff.id &&
      item.date === date &&
      item.status !== 'cancelled' &&
      !((timeToMin(item.time) + (item.serviceDuration || 0)) <= slotStart || timeToMin(item.time) >= slotEnd)
    );
    if (busy) throw new Error('Horario ja ocupado');

    const blocked = db.blocks.find(block =>
      block.staffId === staff.id &&
      block.date === date &&
      !(timeToMin(block.end) <= slotStart || timeToMin(block.start) >= slotEnd)
    );
    if (blocked) throw new Error('Horario bloqueado para esta profissional');

    const appointment = {
      id: 'a' + uid(),
      client_id: clientId || null,
      clientName: clientName || 'Cliente',
      clientPhone: clientPhone || '',
      staffId: staff.id,
      staffName: staff.name || '',
      staffColor: staff.color || '',
      serviceId,
      serviceName: service.name || '',
      serviceIcon: service.icon || '',
      servicePrice: service.price || 0,
      serviceDuration: service.duration || 0,
      date,
      time,
      status,
      paymentStatus,
      paymentMethod,
      notes,
      reminded_day: false,
      reminded_hour: false,
      created_at: now(),
    };

    db.appointments.push(appointment);
    persist();
    return appointment;
  },

  updateAppointment(id, patch) {
    const appointment = db.appointments.find(item => item.id === id);
    if (!appointment) throw new Error('Agendamento nao encontrado');

    const before = { ...appointment };

    if (patch.serviceId !== undefined) {
      const service = db.services.find(item => item.id === patch.serviceId);
      if (!service) throw new Error('Servico nao encontrado');

      appointment.serviceId = service.id;
      appointment.serviceName = service.name || '';
      appointment.serviceIcon = service.icon || '';
      appointment.servicePrice = service.price || 0;
      appointment.serviceDuration = service.duration || 0;
    }

    if (patch.staffId !== undefined) {
      const staff = db.staff.find(item => item.id === patch.staffId && item.active !== false);
      if (!staff) throw new Error('Profissional nao disponivel');

      appointment.staffId = staff.id;
      appointment.staffName = staff.name || '';
      appointment.staffColor = staff.color || '';
    }

    const nextDate = patch.date !== undefined ? patch.date : appointment.date;
    const nextTime = patch.time !== undefined ? patch.time : appointment.time;
    const slotStart = timeToMin(nextTime);
    const slotEnd = slotStart + (appointment.serviceDuration || 0);

    if (patch.date !== undefined || patch.time !== undefined || patch.staffId !== undefined || patch.serviceId !== undefined) {
      const busy = db.appointments.find(item =>
        item.id !== id &&
        item.staffId === appointment.staffId &&
        item.date === nextDate &&
        item.status !== 'cancelled' &&
        !((timeToMin(item.time) + (item.serviceDuration || 0)) <= slotStart || timeToMin(item.time) >= slotEnd)
      );
      if (busy) throw new Error('Horario ja ocupado');

      const blocked = db.blocks.find(block =>
        block.staffId === appointment.staffId &&
        block.date === nextDate &&
        !(timeToMin(block.end) <= slotStart || timeToMin(block.start) >= slotEnd)
      );
      if (blocked) throw new Error('Horario bloqueado para esta profissional');
    }

    if (patch.status !== undefined) appointment.status = patch.status;
    if (patch.notes !== undefined) appointment.notes = patch.notes;
    if (patch.paymentStatus !== undefined) appointment.paymentStatus = patch.paymentStatus;
    if (patch.paymentMethod !== undefined) appointment.paymentMethod = patch.paymentMethod;
    if (patch.clientName !== undefined) appointment.clientName = patch.clientName;
    if (patch.clientPhone !== undefined) appointment.clientPhone = patch.clientPhone;

    appointment.date = nextDate;
    appointment.time = nextTime;
    appointment.updated_at = now();

    persist();
    return { before, after: appointment };
  },

  getConfirmedFrom(dateStr) {
    return db.appointments.filter(item => item.status === 'confirmed' && item.date >= dateStr);
  },

  markReminded(id, type) {
    const appointment = db.appointments.find(item => item.id === id);
    if (appointment) {
      appointment[`reminded_${type}`] = true;
      persist();
    }
  },
};

module.exports = { DB };
