export type Role = 'client' | 'owner';

export type AppointmentStatus = 'pending' | 'confirmed' | 'done' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'partial';

export interface OwnerSession {
  role: 'owner';
  token: string;
  salon: string;
}

export interface ClientSession {
  role: 'client';
  id: string;
  name: string;
  phone: string;
  token: string;
}

export type Session = OwnerSession | ClientSession;

export interface ClientAuthResult {
  client: Client;
  accessToken: string;
  salon?: string;
}

export interface Service {
  id: string;
  name: string;
  icon: string;
  duration: number;
  price: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Staff {
  id: string;
  name: string;
  phone: string;
  color: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface Block {
  id: string;
  staffId: string;
  date: string;
  start: string;
  end: string;
  reason: string;
  created_at?: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  staffId: string;
  staffName: string;
  staffColor: string;
  serviceId: string;
  serviceName: string;
  serviceIcon: string;
  servicePrice: number;
  serviceDuration: number;
  date: string;
  time: string;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}
