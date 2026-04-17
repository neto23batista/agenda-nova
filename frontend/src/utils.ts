import type { Appointment, AppointmentStatus, Block, Client, PaymentStatus, Service, Staff } from './types';

const asRecord = (value: unknown): Record<string, unknown> => (
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
);

const toStringValue = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
};

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toBooleanValue = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered === 'true' || lowered === '1') return true;
    if (lowered === 'false' || lowered === '0') return false;
  }
  return fallback;
};

const appointmentStatusList: AppointmentStatus[] = ['pending', 'confirmed', 'done', 'cancelled'];
const paymentStatusList: PaymentStatus[] = ['unpaid', 'paid', 'partial'];

const toAppointmentStatus = (value: unknown): AppointmentStatus => {
  const typed = toStringValue(value) as AppointmentStatus;
  return appointmentStatusList.includes(typed) ? typed : 'pending';
};

const toPaymentStatus = (value: unknown): PaymentStatus => {
  const typed = toStringValue(value) as PaymentStatus;
  return paymentStatusList.includes(typed) ? typed : 'unpaid';
};

export const normalizeService = (value: unknown): Service => {
  const item = asRecord(value);
  return {
    id: toStringValue(item.id),
    name: toStringValue(item.name),
    icon: toStringValue(item.icon),
    duration: toNumberValue(item.duration, 0),
    price: toNumberValue(item.price, 0),
    active: toBooleanValue(item.active, true),
    created_at: toStringValue(item.created_at),
    updated_at: toStringValue(item.updated_at),
  };
};

export const normalizeStaff = (value: unknown): Staff => {
  const item = asRecord(value);
  return {
    id: toStringValue(item.id),
    name: toStringValue(item.name),
    phone: toStringValue(item.phone),
    color: toStringValue(item.color, '#c26549'),
    active: toBooleanValue(item.active, true),
    created_at: toStringValue(item.created_at),
    updated_at: toStringValue(item.updated_at),
  };
};

export const normalizeClient = (value: unknown): Client => {
  const item = asRecord(value);
  return {
    id: toStringValue(item.id),
    name: toStringValue(item.name),
    phone: toStringValue(item.phone),
    email: toStringValue(item.email),
    notes: toStringValue(item.notes),
    created_at: toStringValue(item.created_at),
    updated_at: toStringValue(item.updated_at),
  };
};

export const normalizeBlock = (value: unknown): Block => {
  const item = asRecord(value);
  return {
    id: toStringValue(item.id),
    staffId: toStringValue(item.staffId),
    date: toStringValue(item.date),
    start: toStringValue(item.start),
    end: toStringValue(item.end),
    reason: toStringValue(item.reason),
    created_at: toStringValue(item.created_at),
  };
};

export const normalizeAppointment = (value: unknown): Appointment => {
  const item = asRecord(value);
  return {
    id: toStringValue(item.id),
    clientId: toStringValue(item.client_id || item.clientId),
    clientName: toStringValue(item.clientName),
    clientPhone: toStringValue(item.clientPhone),
    staffId: toStringValue(item.staffId),
    staffName: toStringValue(item.staffName),
    staffColor: toStringValue(item.staffColor, '#c26549'),
    serviceId: toStringValue(item.serviceId),
    serviceName: toStringValue(item.serviceName),
    serviceIcon: toStringValue(item.serviceIcon),
    servicePrice: toNumberValue(item.servicePrice),
    serviceDuration: toNumberValue(item.serviceDuration, 0),
    date: toStringValue(item.date),
    time: toStringValue(item.time),
    status: toAppointmentStatus(item.status),
    paymentStatus: toPaymentStatus(item.paymentStatus),
    paymentMethod: toStringValue(item.paymentMethod),
    notes: toStringValue(item.notes),
    created_at: toStringValue(item.created_at),
    updated_at: toStringValue(item.updated_at),
  };
};

const toLocalIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayIso = (): string => toLocalIsoDate(new Date());

export const addDaysIso = (value: string, days: number): string => {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
};

export const startOfWeekIso = (value: string): string => {
  const date = new Date(`${value}T12:00:00`);
  const currentDay = date.getDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay;
  date.setDate(date.getDate() + diff);
  return toLocalIsoDate(date);
};

export const weekDates = (value: string): string[] => {
  const start = startOfWeekIso(value);
  return Array.from({ length: 7 }, (_, index) => addDaysIso(start, index));
};

export const money = (value: number): string => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(value || 0);

export const timeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
};

export const minutesToTime = (value: number): string => {
  const hours = Math.floor(value / 60).toString().padStart(2, '0');
  const minutes = Math.max(0, value % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const formatDateLabel = (value: string): string => new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
}).format(new Date(`${value}T12:00:00`));

export const formatDateTime = (date: string, time: string): string => {
  const when = new Date(`${date}T${time}:00`);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(when);
};

export const buildSlots = (start = 8 * 60, end = 20 * 60, step = 30): string[] => {
  const slots: string[] = [];
  for (let cursor = start; cursor <= end; cursor += step) {
    slots.push(minutesToTime(cursor));
  }
  return slots;
};

export const sortAppointments = (left: Appointment, right: Appointment): number => (
  left.date.localeCompare(right.date) || left.time.localeCompare(right.time)
);

export const getPrimaryStaff = (staff: Staff[]): Staff | null => staff.find(item => item.active) || staff[0] || null;

export const statusText: Record<AppointmentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  done: 'Concluido',
  cancelled: 'Cancelado',
};

export const paymentText: Record<PaymentStatus, string> = {
  unpaid: 'Em aberto',
  paid: 'Pago',
  partial: 'Parcial',
};

export const appointmentMatchesSearch = (appointment: Appointment, query: string): boolean => {
  if (!query.trim()) return true;
  const haystack = [
    appointment.clientName,
    appointment.clientPhone,
    appointment.serviceName,
    appointment.notes,
  ].join(' ').toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
};

export const isFutureAppointment = (appointment: Appointment): boolean => {
  const stamp = new Date(`${appointment.date}T${appointment.time}:00`).getTime();
  return stamp >= Date.now() && appointment.status !== 'cancelled' && appointment.status !== 'done';
};

export const nextAppointment = (appointments: Appointment[]): Appointment | null => {
  const sorted = [...appointments]
    .filter(item => item.status !== 'cancelled')
    .sort(sortAppointments);

  return sorted.find(item => new Date(`${item.date}T${item.time}:00`).getTime() >= Date.now()) || null;
};

export const availableSlotsForDay = (
  appointments: Appointment[],
  blocks: Block[],
  date: string,
  serviceDuration: number,
): string[] => {
  const slots = buildSlots();
  return slots.filter(slot => {
    const start = timeToMinutes(slot);
    const end = start + serviceDuration;

    const isBusy = appointments.some(item => (
      item.date === date &&
      item.status !== 'cancelled' &&
      !((timeToMinutes(item.time) + item.serviceDuration) <= start || timeToMinutes(item.time) >= end)
    ));

    if (isBusy) return false;

    const isBlocked = blocks.some(item => (
      item.date === date &&
      !(timeToMinutes(item.end) <= start || timeToMinutes(item.start) >= end)
    ));

    return !isBlocked;
  });
};
