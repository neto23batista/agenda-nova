// database/seed.js — Dados iniciais de demonstração
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const bcrypt  = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("./setup");

// tiny uuid substitute (no extra dep)
const uid = () => Math.random().toString(36).slice(2, 11);
const today = () => new Date().toISOString().split("T")[0];

async function seed() {
  const db = getDb();

  console.log("🌱 Iniciando seed...");

  // ── Limpar dados existentes ────────────────────────────────
  db.exec(`
    DELETE FROM notification_logs;
    DELETE FROM notifications;
    DELETE FROM appointments;
    DELETE FROM services;
    DELETE FROM professionals;
    DELETE FROM users;
  `);

  // ── Dono ──────────────────────────────────────────────────
  const ownerPwd = bcrypt.hashSync(process.env.OWNER_PASSWORD || "belle123", 10);
  const ownerId  = "owner-1";
  db.prepare(`
    INSERT INTO users (id, name, email, phone, password, role)
    VALUES (?, ?, ?, ?, ?, 'owner')
  `).run(ownerId, process.env.OWNER_NAME || "Proprietária", process.env.OWNER_EMAIL || "dono@belle.com", "", ownerPwd);

  // ── Clientes ──────────────────────────────────────────────
  const clients = [
    { id: "c1", name: "Maria Oliveira",  phone: "11999991111", email: "maria@email.com"    },
    { id: "c2", name: "Fernanda Lima",   phone: "11988882222", email: "fernanda@email.com" },
    { id: "c3", name: "Juliana Souza",   phone: "11977773333", email: "juliana@email.com"  },
  ];
  const clientPwd = bcrypt.hashSync("123456", 10);
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, phone, password, role)
    VALUES (?, ?, ?, ?, ?, 'client')
  `);
  for (const c of clients) insertUser.run(c.id, c.name, c.email, c.phone, clientPwd);

  // ── Profissionais ─────────────────────────────────────────
  const professionals = [
    { id: "p1", name: "Ana Silva",    specialty: "Nail Art & Gel",  color: "#c9807a" },
    { id: "p2", name: "Bruna Costa",  specialty: "Pedicure & SPA",  color: "#7a9ec9" },
    { id: "p3", name: "Carla Mendes", specialty: "Alongamento",     color: "#7ac994" },
  ];
  const insertProf = db.prepare(`
    INSERT INTO professionals (id, name, specialty, color) VALUES (?, ?, ?, ?)
  `);
  for (const p of professionals) insertProf.run(p.id, p.name, p.specialty, p.color);

  // ── Serviços ──────────────────────────────────────────────
  const services = [
    { id: "s1", name: "Gel Alongado",         icon: "💅", duration: 90, price: 120 },
    { id: "s2", name: "Fibra de Vidro",        icon: "✨", duration: 80, price: 110 },
    { id: "s3", name: "Manicure Tradicional",  icon: "🌸", duration: 40, price:  45 },
    { id: "s4", name: "Pedicure Completa",     icon: "🦶", duration: 50, price:  55 },
    { id: "s5", name: "Combo Mani + Pedi",     icon: "👑", duration: 90, price:  90 },
    { id: "s6", name: "Esmaltação em Gel",     icon: "🔮", duration: 60, price:  70 },
  ];
  const insertSvc = db.prepare(`
    INSERT INTO services (id, name, icon, duration, price) VALUES (?, ?, ?, ?, ?)
  `);
  for (const s of services) insertSvc.run(s.id, s.name, s.icon, s.duration, s.price);

  // ── Agendamentos de demo ───────────────────────────────────
  const appts = [
    { id: "a1", client_id: "c1", service_id: "s1", professional_id: "p1", date: today(), time: "09:00", status: "confirmed", notes: "Cliente VIP" },
    { id: "a2", client_id: "c2", service_id: "s4", professional_id: "p2", date: today(), time: "11:00", status: "pending",   notes: ""           },
    { id: "a3", client_id: "c3", service_id: "s3", professional_id: "p3", date: today(), time: "14:00", status: "confirmed", notes: ""           },
  ];
  const insertAppt = db.prepare(`
    INSERT INTO appointments (id, client_id, service_id, professional_id, date, time, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const a of appts) insertAppt.run(a.id, a.client_id, a.service_id, a.professional_id, a.date, a.time, a.status, a.notes);

  // ── Notificações de demo ───────────────────────────────────
  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, type, recipient_role, appointment_id, title, message, read, created_at)
    VALUES (?, ?, 'owner', ?, ?, ?, ?, ?)
  `);
  insertNotif.run(uid(), "new_booking", "a2", "Novo agendamento!", "Fernanda Lima agendou Pedicure Completa para hoje às 11:00", 0, new Date(Date.now()-300000).toISOString());
  insertNotif.run(uid(), "new_booking", "a1", "Novo agendamento!", "Maria Oliveira agendou Gel Alongado para hoje às 09:00",    0, new Date(Date.now()-1320000).toISOString());
  insertNotif.run(uid(), "new_booking", "a3", "Novo agendamento!", "Juliana Souza agendou Manicure Tradicional para hoje às 14:00", 1, new Date(Date.now()-3600000).toISOString());

  console.log("✅ Seed concluído com sucesso!");
  console.log(`   👑 Dono:    ${process.env.OWNER_EMAIL || "dono@belle.com"} / ${process.env.OWNER_PASSWORD || "belle123"}`);
  console.log(`   👩 Clientes: maria@email.com / 123456`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
