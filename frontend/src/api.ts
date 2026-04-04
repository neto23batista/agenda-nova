import type { Appointment, Block, Client, PaymentStatus, Service, Staff } from './types';
import {
  normalizeAppointment,
  normalizeBlock,
  normalizeClient,
  normalizeService,
  normalizeStaff,
} from './utils';

const baseUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

const buildUrl = (path: string): string => `${baseUrl}${path}`;

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = await response.json() as { error?: string };
    return data.error || `Falha ${response.status}`;
  } catch {
    return `Falha ${response.status}`;
  }
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(buildUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
};

const authHeaders = (token?: string): HeadersInit => (
  token ? { Authorization: `Bearer ${token}` } : {}
);

const queryString = (params: Record<string, string | undefined>): string => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
};

export const api = {
  async loginOwner(password: string): Promise<{ token: string; salon: string }> {
    return request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  async clientAccess(payload: { name: string; phone: string }): Promise<Client> {
    const data = await request<unknown>('/api/client-access', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeClient(data);
  },

  async getServices(includeInactive = false): Promise<Service[]> {
    const data = await request<unknown[]>(`/api/services${includeInactive ? '?all=1' : ''}`);
    return data.map(normalizeService);
  },

  async createService(payload: { name: string; icon: string; duration: number; price: number; active: boolean }, token: string): Promise<Service> {
    const data = await request<unknown>('/api/services', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    return normalizeService(data);
  },

  async updateService(id: string, payload: Partial<{ name: string; icon: string; duration: number; price: number; active: boolean }>, token: string): Promise<Service> {
    const data = await request<unknown>(`/api/services/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    return normalizeService(data);
  },

  async getStaff(includeInactive = false): Promise<Staff[]> {
    const data = await request<unknown[]>(`/api/staff${includeInactive ? '?all=1' : ''}`);
    return data.map(normalizeStaff);
  },

  async createStaff(payload: { name: string; phone: string; color: string; active: boolean }, token: string): Promise<Staff> {
    const data = await request<unknown>('/api/staff', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    return normalizeStaff(data);
  },

  async updateStaff(id: string, payload: Partial<{ name: string; phone: string; color: string; active: boolean }>, token: string): Promise<Staff> {
    const data = await request<unknown>(`/api/staff/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    return normalizeStaff(data);
  },

  async getClients(token: string): Promise<Client[]> {
    const data = await request<unknown[]>('/api/clients', { headers: authHeaders(token) });
    return data.map(normalizeClient);
  },

  async createClient(payload: { name: string; phone: string; email: string; notes: string }, token: string): Promise<Client> {
    const data = await request<unknown>('/api/clients', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    return normalizeClient(data);
  },

  async updateClient(id: string, payload: Partial<{ name: string; phone: string; email: string; notes: string }>, token: string): Promise<Client> {
    const data = await request<unknown>(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    return normalizeClient(data);
  },

  async getBlocks(staffId?: string): Promise<Block[]> {
    const data = await request<unknown[]>(`/api/blocks${queryString({ staffId })}`);
    return data.map(normalizeBlock);
  },

  async createBlock(payload: { staffId: string; date: string; start: string; end: string; reason: string }, token: string): Promise<Block> {
    const data = await request<unknown>('/api/blocks', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    return normalizeBlock(data);
  },

  async deleteBlock(id: string, token: string): Promise<void> {
    await request(`/api/blocks/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },

  async getAppointments(params: { clientId?: string; staffId?: string; date?: string; status?: string }): Promise<Appointment[]> {
    const data = await request<unknown[]>(`/api/appointments${queryString(params)}`);
    return data.map(normalizeAppointment);
  },

  async createAppointment(payload: {
    clientId?: string;
    clientName: string;
    clientPhone: string;
    serviceId: string;
    staffId?: string;
    date: string;
    time: string;
    notes?: string;
    status?: string;
    paymentStatus?: PaymentStatus;
    paymentMethod?: string;
  }): Promise<Appointment> {
    const data = await request<unknown>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeAppointment(data);
  },

  async updateAppointment(id: string, payload: Partial<{
    status: string;
    notes: string;
    date: string;
    time: string;
    clientName: string;
    clientPhone: string;
    serviceId: string;
    staffId: string;
    paymentStatus: PaymentStatus;
    paymentMethod: string;
  }>, token?: string): Promise<Appointment> {
    const data = await request<unknown>(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    return normalizeAppointment(data);
  },
};
