// database/seed.js — Dados iniciais
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const bcrypt = require("bcryptjs");
const { db } = require("./setup");

const uid = () => Math.random().toString(36).slice(2, 11);
const today = () => new Date().toISOString().split("T")[0];

async function seed() {
  console.log("🌱 Limpando banco...");
  db.set("users", []).set("professionals", []).set("services", [])
    .set("appointments", []).set("notifications", []).set("notification_logs", []).write();

  // ── Dono ──
  const ownerPwd = bcrypt.hashSync(process.env.OWNER_PASSWORD || "belle123", 10);
  db.get("users").push({
    id: "owner-1", name: process.env.OWNER_NAME || "Proprietária",
    email: process.env.OWNER_EMAIL || "dono@belle.com",
    phone: "", password: ownerPwd, role: "owner", active: true,
    created_at: new Date().toISOString(),
  }).write();

  // ── Clientes ──
  const clientPwd = bcrypt.hashSync("123456", 10);
  const clients = [
    { id: "c1", name: "Maria Oliveira",  phone: "11999991111", email: "maria@email.com"     },
    { id: "c2", name: "Fernanda Lima",   phone: "11988882222", email: "fernanda@email.com"  },
    { id: "c3", name: "Juliana Souza",   phone: "11977773333", email: "juliana@email.com"   },
  ];
  clients.forEach(c => db.get("users").push({ ...c, password: clientPwd, role: "client", active: true, created_at: new Date().toISOString() }).write());

  // ── Profissionais ──
  [
    { id: "p1", name: "Ana Silva",    specialty: "Nail Art & Gel",  color: "#c9807a", active: true },
    { id: "p2", name: "Bruna Costa",  specialty: "Pedicure & SPA",  color: "#7a9ec9", active: true },
    { id: "p3", name: "Carla Mendes", specialty: "Alongamento",     color: "#7ac994", active: true },
  ].forEach(p => db.get("professionals").push(p).write());

  // ── Serviços ──
  [
    { id: "s1", name: "Gel Alongado",         icon: "💅", duration: 90, price: 120, active: true },
    { id: "s2", name: "Fibra de Vidro",        icon: "✨", duration: 80, price: 110, active: true },
    { id: "s3", name: "Manicure Tradicional",  icon: "🌸", duration: 40, price:  45, active: true },
    { id: "s4", name: "Pedicure Completa",     icon: "🦶", duration: 50, price:  55, active: true },
    { id: "s5", name: "Combo Mani + Pedi",     icon: "👑", duration: 90, price:  90, active: true },
    { id: "s6", name: "Esmaltação em Gel",     icon: "🔮", duration: 60, price:  70, active: true },
  ].forEach(s => db.get("services").push(s).write());

  // ── Agendamentos de hoje ──
  const t = today();
  [
    { id: "a1", clientId: "c1", serviceId: "s1", professionalId: "p1", date: t, time: "09:00", status: "confirmed", notes: "VIP", consentRequest: null, created_at: new Date().toISOString() },
    { id: "a2", clientId: "c2", serviceId: "s4", professionalId: "p2", date: t, time: "11:00", status: "pending",   notes: "",    consentRequest: null, created_at: new Date().toISOString() },
    { id: "a3", clientId: "c3", serviceId: "s3", professionalId: "p3", date: t, time: "14:00", status: "confirmed", notes: "",    consentRequest: null, created_at: new Date().toISOString() },
  ].forEach(a => db.get("appointments").push(a).write());

  // ── Notificações de demo ──
  [
    { id: uid(), type: "new_booking", recipient_role: "owner", appointment_id: "a2", title: "Novo agendamento!", message: "Fernanda Lima agendou Pedicure Completa para hoje às 11:00", read: false, created_at: new Date(Date.now()-300000).toISOString() },
    { id: uid(), type: "new_booking", recipient_role: "owner", appointment_id: "a1", title: "Novo agendamento!", message: "Maria Oliveira agendou Gel Alongado para hoje às 09:00",    read: false, created_at: new Date(Date.now()-1320000).toISOString() },
    { id: uid(), type: "new_booking", recipient_role: "owner", appointment_id: "a3", title: "Novo agendamento!", message: "Juliana Souza agendou Manicure Tradicional para hoje às 14:00", read: true, created_at: new Date(Date.now()-3600000).toISOString() },
  ].forEach(n => db.get("notifications").push(n).write());

  console.log("✅ Seed concluído!");
  console.log(`   👑 Dono:    ${process.env.OWNER_EMAIL || "dono@belle.com"} / ${process.env.OWNER_PASSWORD || "belle123"}`);
  console.log(`   👩 Cliente: maria@email.com / 123456`);
}

seed();
