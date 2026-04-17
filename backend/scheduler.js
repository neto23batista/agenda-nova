'use strict';

const cron = require('node-cron');

const { DB } = require('./db');
const {
  notifyReminderDay,
  notifyReminderHour,
  notifyOwnerReminder,
} = require('./whatsapp');

const SCHEDULER_TIMEZONE = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

function localDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHEDULER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find(part => part.type === 'year')?.value || '0000';
  const month = parts.find(part => part.type === 'month')?.value || '01';
  const day = parts.find(part => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function todayStr() {
  return localDateString(new Date());
}

function tomorrowStr() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return localDateString(next);
}

function isWithinOneHour(appointment) {
  const now = new Date();
  const appointmentDate = new Date(`${appointment.date}T${appointment.time}:00`);
  const diff = appointmentDate.getTime() - now.getTime();
  return diff > 0 && diff <= 60 * 60 * 1000;
}

async function runCheck() {
  const stamp = new Date().toLocaleString('pt-BR', { timeZone: SCHEDULER_TIMEZONE });
  console.log(`\n[scheduler ${stamp}] checking reminders...`);

  const today = todayStr();
  const tomorrow = tomorrowStr();
  let sent = 0;

  try {
    const appointments = DB.getConfirmedFrom(today);

    for (const appointment of appointments) {
      if (appointment.date === tomorrow && !appointment.reminded_day) {
        console.log(`[scheduler] D-1 -> ${appointment.clientName} (${appointment.date} ${appointment.time})`);
        await notifyReminderDay(appointment);
        DB.markReminded(appointment.id, 'day');
        sent += 1;
      }

      if (!appointment.reminded_hour && isWithinOneHour(appointment)) {
        console.log(`[scheduler] H-1 -> ${appointment.clientName} (${appointment.date} ${appointment.time})`);
        await notifyReminderHour(appointment);
        await notifyOwnerReminder(appointment);
        DB.markReminded(appointment.id, 'hour');
        sent += 1;
      }
    }

    console.log(`[scheduler] ${appointments.length} appointments checked, ${sent} reminders sent.`);
  } catch (error) {
    console.error('[scheduler] error while checking reminders:', error.message);
  }
}

function startScheduler() {
  cron.schedule('*/30 * * * *', runCheck, { timezone: SCHEDULER_TIMEZONE });

  const startupRun = setTimeout(runCheck, 5000);
  if (typeof startupRun.unref === 'function') startupRun.unref();

  console.log(`[scheduler] started with timezone ${SCHEDULER_TIMEZONE}.`);
}

module.exports = { startScheduler };
