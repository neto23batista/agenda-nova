import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type {
  Appointment,
  AppointmentStatus,
  Block,
  Client,
  ClientSession,
  OwnerSession,
  PaymentStatus,
  Service,
  Session,
  Staff,
} from './types';
import {
  addDaysIso,
  appointmentMatchesSearch,
  availableSlotsForDay,
  formatDateLabel,
  formatDateTime,
  getPrimaryStaff,
  isFutureAppointment,
  money,
  nextAppointment,
  paymentText,
  sortAppointments,
  startOfWeekIso,
  statusText,
  timeToMinutes,
  todayIso,
  weekDates,
} from './utils';

const SESSION_KEY = 'fernanda-silva-agenda.session';
const LEGACY_SESSION_KEY = 'belle-agenda.session';
const BRAND_NAME = 'Fernanda Silva Nail Designer';
const BRAND_LOGO = '/brand/fernanda-silva-logo.png';
const timelineStart = 8 * 60;
const timelineEnd = 20 * 60;
const timelineStep = 30;
const slotHeight = 54;

type OwnerTab = 'agenda' | 'services' | 'clients' | 'availability' | 'profile';
type AgendaMode = 'day' | 'week';
type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ServiceDraft {
  name: string;
  icon: string;
  duration: string;
  price: string;
  active: boolean;
}

interface ClientDraft {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

interface BlockDraft {
  date: string;
  start: string;
  end: string;
  reason: string;
}

interface BookingDraft {
  serviceId: string;
  date: string;
  time: string;
  notes: string;
}

interface QuickBookingDraft {
  clientName: string;
  clientPhone: string;
  serviceId: string;
  time: string;
  notes: string;
}

interface ProfessionalDraft {
  name: string;
  phone: string;
  color: string;
}

const emptyServiceDraft = (): ServiceDraft => ({
  name: '',
  icon: '',
  duration: '60',
  price: '0',
  active: true,
});

const emptyClientDraft = (): ClientDraft => ({
  name: '',
  phone: '',
  email: '',
  notes: '',
});

const emptyQuickBookingDraft = (): QuickBookingDraft => ({
  clientName: '',
  clientPhone: '',
  serviceId: '',
  time: '',
  notes: '',
});

const emptyProfessionalDraft = (): ProfessionalDraft => ({
  name: '',
  phone: '',
  color: '#c26549',
});

const looksLikeSignedToken = (value: unknown): value is string => (
  typeof value === 'string' && value.includes('.') && value.split('.').length === 2
);

const readStoredSession = (): Session | null => {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY) || window.localStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed && parsed.role === 'owner' && looksLikeSignedToken(parsed.token)) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
      window.localStorage.removeItem(LEGACY_SESSION_KEY);
      return parsed;
    }
    if (parsed && parsed.role === 'client' && parsed.id && looksLikeSignedToken(parsed.token)) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
      window.localStorage.removeItem(LEGACY_SESSION_KEY);
      return parsed;
    }
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
  }
  return null;
};

const storeSession = (session: Session | null): void => {
  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.localStorage.removeItem(LEGACY_SESSION_KEY);
};

const useToasts = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems(current => current.filter(item => item.id !== id));
  }, []);

  const push = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setItems(current => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setItems(current => current.filter(item => item.id !== id));
    }, 3200);
  }, []);

  return { items, push, dismiss };
};

const ToastViewport = ({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: string) => void }) => (
  <div className="toast-viewport" aria-live="polite" aria-atomic="true">
    {items.map(item => (
      <button key={item.id} type="button" className={`toast toast-${item.tone}`} onClick={() => onDismiss(item.id)}>
        {item.message}
      </button>
    ))}
  </div>
);

const BrandMark = ({ compact = false, hero = false }: { compact?: boolean; hero?: boolean }) => (
  <div className={`brand-mark${compact ? ' brand-mark-compact' : ''}${hero ? ' brand-mark-hero' : ''}`}>
    <img className="brand-mark-image" src={BRAND_LOGO} alt={BRAND_NAME} />
  </div>
);

const HeaderIdentity = ({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) => (
  <div className="header-identity">
    <BrandMark compact />
    <div className="header-copy">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  </div>
);

const AgendaSnapshot = ({
  items,
}: {
  items: Array<{ label: string; value: string | number; helper: string }>;
}) => (
  <div className="agenda-snapshot">
    {items.map(item => (
      <article key={item.label} className="agenda-snapshot-item">
        <span>{item.label}</span>
        <strong>{item.value}</strong>
        <small>{item.helper}</small>
      </article>
    ))}
  </div>
);

const EmptyState = ({ title, text }: { title: string; text: string }) => (
  <div className="empty-state">
    <strong>{title}</strong>
    <p>{text}</p>
  </div>
);

const MetricCard = ({ label, value, helper }: { label: string; value: string | number; helper: string }) => (
  <article className="metric-card">
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{helper}</small>
  </article>
);

const StatusBadge = ({ status }: { status: AppointmentStatus }) => (
  <span className={`pill pill-status pill-${status}`}>{statusText[status]}</span>
);

const PaymentBadge = ({ status }: { status: PaymentStatus }) => (
  <span className={`pill pill-payment pill-${status}`}>{paymentText[status]}</span>
);

const normalizePhoneInput = (value: string): string => value.replace(/[^\d]/g, '').slice(0, 15);

const scheduleHeight = ((timelineEnd - timelineStart) / timelineStep) * slotHeight;
const scheduleMarks = Array.from({ length: ((timelineEnd - timelineStart) / timelineStep) + 1 }, (_, index) => timelineStart + (timelineStep * index));

const ScheduleBoard = ({
  professional,
  appointments,
  blocks,
}: {
  professional: Staff | null;
  appointments: Appointment[];
  blocks: Block[];
}) => {
  if (!professional) {
    return <EmptyState title="Sem profissional ativa" text="Configure a profissional principal para exibir a agenda." />;
  }

  return (
    <section className="schedule-card">
      <header className="schedule-head">
        <div>
          <span className="eyebrow">Agenda do dia</span>
          <h3>{professional.name}</h3>
        </div>
        <div className="schedule-legend">
          <span><i className="legend-pending" /> Pendentes</span>
          <span><i className="legend-confirmed" /> Confirmados</span>
          <span><i className="legend-done" /> Concluidos</span>
          <span><i className="legend-block" /> Bloqueios</span>
        </div>
      </header>

      <div className="schedule-grid">
        <div className="schedule-hours">
          {scheduleMarks.map(mark => (
            <div key={mark} className="schedule-hour" style={{ height: `${slotHeight}px` }}>
              {`${String(Math.floor(mark / 60)).padStart(2, '0')}:${String(mark % 60).padStart(2, '0')}`}
            </div>
          ))}
        </div>

        <div className="schedule-stage" style={{ height: `${scheduleHeight}px` }}>
          {scheduleMarks.map(mark => (
            <div
              key={mark}
              className={`schedule-line ${mark % 60 === 0 ? 'schedule-line-strong' : ''}`}
              style={{ top: `${((mark - timelineStart) / timelineStep) * slotHeight}px` }}
            />
          ))}

          {blocks.map(block => {
            const top = ((timeToMinutes(block.start) - timelineStart) / timelineStep) * slotHeight;
            const height = ((timeToMinutes(block.end) - timeToMinutes(block.start)) / timelineStep) * slotHeight;
            return (
              <article key={block.id} className="schedule-block" style={{ top: `${top}px`, height: `${height}px` }}>
                <strong>{block.reason || 'Indisponivel'}</strong>
                <span>{block.start} - {block.end}</span>
              </article>
            );
          })}

          {appointments.map(appointment => {
            const top = ((timeToMinutes(appointment.time) - timelineStart) / timelineStep) * slotHeight;
            const height = Math.max(((appointment.serviceDuration || 30) / timelineStep) * slotHeight - 6, 64);
            return (
              <article key={appointment.id} className={`schedule-appointment schedule-${appointment.status}`} style={{ top: `${top}px`, height: `${height}px`, borderColor: professional.color }}>
                <div className="schedule-appointment-time">{appointment.time}</div>
                <strong>{appointment.clientName}</strong>
                <p>{appointment.serviceName}</p>
                <div className="schedule-appointment-meta">
                  <StatusBadge status={appointment.status} />
                  <PaymentBadge status={appointment.paymentStatus} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const WeekBoard = ({
  week,
  selectedDate,
  onSelectDate,
  appointments,
  blocks,
}: {
  week: string[];
  selectedDate: string;
  onSelectDate: (value: string) => void;
  appointments: Appointment[];
  blocks: Block[];
}) => (
  <section className="panel week-board">
    <div className="panel-head">
      <div>
        <span className="eyebrow">Semana</span>
        <h2>Visao semanal</h2>
      </div>
    </div>
    <div className="week-grid">
      {week.map(day => {
        const dayAppointments = appointments
          .filter(item => item.date === day)
          .sort((left, right) => left.time.localeCompare(right.time));
        const dayBlocks = blocks.filter(item => item.date === day);

        return (
          <button
            key={day}
            type="button"
            className={selectedDate === day ? 'week-day active' : 'week-day'}
            onClick={() => onSelectDate(day)}
          >
            <div className="week-day-head">
              <strong>{formatDateLabel(day)}</strong>
              <span>{dayAppointments.length} atendimento(s)</span>
            </div>
            <div className="week-day-body">
              {!dayAppointments.length && !dayBlocks.length && (
                <small>Agenda livre</small>
              )}
              {dayBlocks.slice(0, 1).map(block => (
                <div key={block.id} className="week-pill week-pill-block">
                  {block.start} bloqueado
                </div>
              ))}
              {dayAppointments.slice(0, 4).map(item => (
                <div key={item.id} className={`week-pill week-pill-${item.status}`}>
                  <span>{item.time}</span>
                  <strong>{item.clientName}</strong>
                </div>
              ))}
              {dayAppointments.length > 4 && (
                <small>+ {dayAppointments.length - 4} horario(s)</small>
              )}
            </div>
          </button>
        );
      })}
    </div>
  </section>
);

const LandingPage = ({ onLogin }: { onLogin: (session: Session) => void }) => {
  const toasts = useToasts();
  const [mode, setMode] = useState<'client' | 'owner'>('client');
  const [clientAuthMode, setClientAuthMode] = useState<'login' | 'register'>('login');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientPasswordConfirm, setClientPasswordConfirm] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleClientSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (normalizePhoneInput(clientPhone).length < 10) {
      toasts.push('Informe um WhatsApp valido', 'error');
      return;
    }

    if (clientAuthMode === 'register') {
      if (!clientName.trim()) {
        toasts.push('Informe seu nome', 'error');
        return;
      }

      if (clientPassword.length < 4) {
        toasts.push('Use uma senha com pelo menos 4 caracteres', 'error');
        return;
      }

      if (clientPassword !== clientPasswordConfirm) {
        toasts.push('As senhas nao conferem', 'error');
        return;
      }
    }

    if (clientAuthMode === 'login' && clientPassword.length < 4) {
      toasts.push('Informe sua senha', 'error');
      return;
    }

    setBusy(true);
    try {
      const response = clientAuthMode === 'register'
        ? await api.registerClient({
          name: clientName.trim(),
          phone: normalizePhoneInput(clientPhone),
          password: clientPassword,
        })
        : await api.loginClient({
          phone: normalizePhoneInput(clientPhone),
          password: clientPassword,
        });
      const client = response.client;
      const session: ClientSession = {
        role: 'client',
        id: client.id,
        name: client.name,
        phone: client.phone,
        token: response.accessToken,
      };
      storeSession(session);
      onLogin(session);
    } catch (error) {
      toasts.push(error instanceof Error ? error.message : 'Falha ao entrar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleOwnerLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await api.loginOwner(ownerPassword);
      const session: OwnerSession = {
        role: 'owner',
        token: response.token,
        salon: response.salon,
      };
      storeSession(session);
      onLogin(session);
    } catch (error) {
      toasts.push(error instanceof Error ? error.message : 'Falha ao entrar', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page page-login">
      <ToastViewport items={toasts.items} onDismiss={toasts.dismiss} />
      <section className="login-shell-simple">
        <article className="login-card login-card-split">
          <div className="login-intro">
            <div className="login-brand">
              <BrandMark />
              <div className="login-brand-copy">
                <h1>Agenda online.</h1>
                <p>Cliente agenda. Gestora acompanha.</p>
              </div>
            </div>

            <div className="login-intro-accent" aria-hidden="true" />
          </div>

          <div className="login-access-card">
            <div className="login-panel-head">
              <span className="eyebrow">Acesso</span>
              <h2>{mode === 'client' ? 'Entrar como cliente' : 'Entrar no painel'}</h2>
              <p>{mode === 'client' ? 'Entre ou crie seu acesso.' : 'Acesse a agenda e a disponibilidade.'}</p>
            </div>

            <div className="login-switcher">
              <button type="button" className={mode === 'client' ? 'active' : ''} onClick={() => setMode('client')}>Sou cliente</button>
              <button type="button" className={mode === 'owner' ? 'active' : ''} onClick={() => setMode('owner')}>Sou gestora</button>
            </div>

            {mode === 'client' ? (
              <form className="login-form" onSubmit={handleClientSubmit}>
                <div className="login-mini-switcher">
                  <button type="button" className={clientAuthMode === 'login' ? 'active' : ''} onClick={() => setClientAuthMode('login')}>Entrar</button>
                  <button type="button" className={clientAuthMode === 'register' ? 'active' : ''} onClick={() => setClientAuthMode('register')}>Cadastrar</button>
                </div>
                {clientAuthMode === 'register' && (
                  <label>
                    Nome completo
                    <input value={clientName} onChange={event => setClientName(event.target.value)} placeholder="Seu nome" />
                  </label>
                )}
                <label>
                  WhatsApp
                  <input value={clientPhone} onChange={event => setClientPhone(normalizePhoneInput(event.target.value))} placeholder="11999999999" />
                </label>
                <label>
                  Senha
                  <input type="password" value={clientPassword} onChange={event => setClientPassword(event.target.value)} placeholder={clientAuthMode === 'register' ? 'Crie uma senha' : 'Sua senha'} />
                </label>
                {clientAuthMode === 'register' && (
                  <label>
                    Confirmar senha
                    <input type="password" value={clientPasswordConfirm} onChange={event => setClientPasswordConfirm(event.target.value)} placeholder="Repita a senha" />
                  </label>
                )}
                <button className="button button-primary" type="submit" disabled={busy}>
                  {clientAuthMode === 'register' ? 'Criar acesso' : 'Entrar como cliente'}
                </button>
              </form>
            ) : (
              <form className="login-form" onSubmit={handleOwnerLogin}>
                <label>
                  Senha
                  <input type="password" value={ownerPassword} onChange={event => setOwnerPassword(event.target.value)} placeholder="Sua senha" />
                </label>
                <button className="button button-primary" type="submit" disabled={busy}>Entrar no painel</button>
              </form>
            )}
          </div>
        </article>
      </section>
    </main>
  );
};

const ClientWorkspace = ({ session, onLogout }: { session: ClientSession; onLogout: () => void }) => {
  const toasts = useToasts();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [draft, setDraft] = useState<BookingDraft>({ serviceId: '', date: todayIso(), time: '', notes: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [serviceRows, staffRows, appointmentRows] = await Promise.all([
        api.getServices(false),
        api.getStaff(false),
        api.getAppointments({ clientId: session.id }, { clientToken: session.token }),
      ]);

      const activeStaff = staffRows.filter(item => item.active);
      const primary = getPrimaryStaff(activeStaff.length ? activeStaff : staffRows);
      const blockRows = primary ? await api.getBlocks(primary.id) : [];

      setServices(serviceRows.filter(item => item.active));
      setStaff(primary ? [primary] : []);
      setBlocks(blockRows.filter(item => !primary || item.staffId === primary.id));
      setAppointments(appointmentRows.sort(sortAppointments));
      setDraft(current => ({
        ...current,
        serviceId: current.serviceId || serviceRows.find(item => item.active)?.id || '',
      }));
    } catch (error) {
      toasts.push(error instanceof Error ? error.message : 'Falha ao carregar seus dados', 'error');
    } finally {
      setLoading(false);
    }
  }, [session.id, session.token, toasts.push]);

  useEffect(() => {
    void load();
  }, [load]);

  const professional = useMemo(() => getPrimaryStaff(staff), [staff]);
  const selectedService = useMemo(() => services.find(item => item.id === draft.serviceId) || null, [services, draft.serviceId]);
  const nextBooking = useMemo(() => nextAppointment(appointments), [appointments]);
  const upcoming = useMemo(() => appointments.filter(isFutureAppointment), [appointments]);
  const history = useMemo(() => appointments.filter(item => !isFutureAppointment(item)), [appointments]);
  const dayAppointments = useMemo(() => appointments.filter(item => item.date === draft.date && item.staffId === professional?.id), [appointments, draft.date, professional]);
  const dayBlocks = useMemo(() => blocks.filter(item => item.date === draft.date && item.staffId === professional?.id), [blocks, draft.date, professional]);
  const slots = useMemo(() => {
    if (!selectedService) return [];
    return availableSlotsForDay(dayAppointments, dayBlocks, draft.date, selectedService.duration);
  }, [dayAppointments, dayBlocks, draft.date, selectedService]);

  const handleBook = async () => {
    if (!selectedService || !professional || !draft.time) {
      toasts.push('Escolha servico, data e horario', 'error');
      return;
    }

    setBusy(true);
    try {
      await api.createAppointment({
        clientId: session.id,
        clientName: session.name,
        clientPhone: session.phone,
        serviceId: selectedService.id,
        staffId: professional.id,
        date: draft.date,
        time: draft.time,
        notes: draft.notes.trim(),
        status: 'pending',
      }, { clientToken: session.token });
      setDraft(current => ({ ...current, time: '', notes: '' }));
      toasts.push('Agendamento enviado', 'success');
      await load();
    } catch (error) {
      toasts.push(error instanceof Error ? error.message : 'Falha ao agendar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (appointmentId: string) => {
    setBusy(true);
    try {
      await api.updateAppointment(appointmentId, { status: 'cancelled' }, { clientToken: session.token });
      toasts.push('Agendamento cancelado', 'success');
      await load();
    } catch (error) {
      toasts.push(error instanceof Error ? error.message : 'Falha ao cancelar', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <ToastViewport items={toasts.items} onDismiss={toasts.dismiss} />
      <section className="app-shell">
        <header className="topbar">
          <div className="topbar-main">
            <HeaderIdentity
              eyebrow="Portal do cliente"
              title={`Ola, ${session.name.split(' ')[0]}`}
              subtitle="Agende, acompanhe e ajuste seus horarios com rapidez."
            />
          </div>
          <div className="topbar-actions">
            <button className="button button-secondary" type="button" onClick={() => void load()}>Atualizar</button>
            <button className="button button-primary" type="button" onClick={onLogout}>Sair</button>
          </div>
        </header>

        <section className="metric-grid">
          <MetricCard label="Proximo horario" value={nextBooking ? nextBooking.time : '--:--'} helper={nextBooking ? formatDateLabel(nextBooking.date) : 'Sem horario futuro'} />
          <MetricCard label="Atendimentos futuros" value={upcoming.length} helper="Pendentes ou confirmados" />
          <MetricCard label="Historico" value={history.length} helper="Atendimentos concluidos ou cancelados" />
          <MetricCard label="Profissional" value={professional?.name || 'Nao definida'} helper="Profissional principal da agenda" />
        </section>

        {loading ? <EmptyState title="Carregando" text="Buscando sua agenda." /> : (
          <section className="content-grid">
            <article className="panel booking-panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Novo agendamento</span>
                  <h2>Escolha seu horario</h2>
                </div>
              </div>

              {!professional && <EmptyState title="Agenda indisponivel" text="Nenhuma profissional ativa foi configurada." />}
              {!!professional && (
                <>
                  <div className="field-grid">
                    <label>
                      Servico
                      <select value={draft.serviceId} onChange={event => setDraft(current => ({ ...current, serviceId: event.target.value, time: '' }))}>
                        {services.map(service => (
                          <option key={service.id} value={service.id}>{service.name} - {money(service.price)}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Data
                      <input type="date" min={todayIso()} value={draft.date} onChange={event => setDraft(current => ({ ...current, date: event.target.value, time: '' }))} />
                    </label>
                  </div>

                  <div className="booking-summary">
                    <div>
                      <span>Servico</span>
                      <strong>{selectedService?.name || '--'}</strong>
                    </div>
                    <div>
                      <span>Duracao</span>
                      <strong>{selectedService?.duration || 0} min</strong>
                    </div>
                    <div>
                      <span>Valor</span>
                      <strong>{money(selectedService?.price || 0)}</strong>
                    </div>
                    <div>
                      <span>Profissional</span>
                      <strong>{professional.name}</strong>
                    </div>
                  </div>

                  <div className="slot-list">
                    {slots.map(slot => (
                      <button key={slot} type="button" className={draft.time === slot ? 'slot active' : 'slot'} onClick={() => setDraft(current => ({ ...current, time: slot }))}>
                        {slot}
                      </button>
                    ))}
                  </div>

                  {!slots.length && <EmptyState title="Sem horarios livres" text="Troque a data ou tente outro servico." />}

                  <label>
                    Observacoes
                    <textarea value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Opcional" />
                  </label>

                  <button className="button button-primary button-block" type="button" disabled={busy || !draft.time} onClick={() => void handleBook()}>
                    Confirmar agendamento
                  </button>
                </>
              )}
            </article>

            <div className="stack-column">
              <article className="panel">
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">Proximos horarios</span>
                    <h2>Sua agenda</h2>
                  </div>
                </div>
                {!upcoming.length && <EmptyState title="Sem horarios futuros" text="Seu proximo agendamento aparece aqui." />}
                <div className="list-grid">
                  {upcoming.map(item => (
                    <article key={item.id} className="list-card">
                      <div className="list-card-main">
                        <strong>{item.serviceName}</strong>
                        <p>{formatDateTime(item.date, item.time)}</p>
                        <div className="badge-row">
                          <StatusBadge status={item.status} />
                          <PaymentBadge status={item.paymentStatus} />
                        </div>
                      </div>
                      {(item.status === 'pending' || item.status === 'confirmed') && (
                        <button className="button button-secondary" type="button" disabled={busy} onClick={() => void handleCancel(item.id)}>
                          Cancelar
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </article>

              <article className="panel">
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">Historico</span>
                    <h2>Atendimentos anteriores</h2>
                  </div>
                </div>
                {!history.length && <EmptyState title="Sem historico" text="Seus atendimentos anteriores aparecem aqui." />}
                <div className="list-grid">
                  {history.map(item => (
                    <article key={item.id} className="list-card history-card">
                      <div className="list-card-main">
                        <strong>{item.serviceName}</strong>
                        <p>{formatDateTime(item.date, item.time)}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </article>
                  ))}
                </div>
              </article>
            </div>
          </section>
        )}
      </section>
    </main>
  );
};

const ServicesTab = ({ services, token, onRefresh, onFeedback }: { services: Service[]; token: string; onRefresh: () => Promise<void>; onFeedback: (message: string, tone: ToastTone) => void }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(emptyServiceDraft());
  const [busy, setBusy] = useState(false);

  const startEdit = (service: Service) => {
    setEditingId(service.id);
    setDraft({
      name: service.name,
      icon: service.icon,
      duration: String(service.duration),
      price: String(service.price),
      active: service.active,
    });
  };

  const reset = () => {
    setEditingId(null);
    setDraft(emptyServiceDraft());
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        name: draft.name.trim(),
        icon: draft.icon.trim(),
        duration: Number(draft.duration),
        price: Number(draft.price),
        active: draft.active,
      };
      if (editingId) {
        await api.updateService(editingId, payload, token);
        onFeedback('Servico atualizado', 'success');
      } else {
        await api.createService(payload, token);
        onFeedback('Servico criado', 'success');
      }
      reset();
      await onRefresh();
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'Falha ao salvar servico', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tab-layout">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Catalogo</span>
            <h2>{editingId ? 'Editar servico' : 'Novo servico'}</h2>
          </div>
          {editingId && <button className="button button-secondary" type="button" onClick={reset}>Novo</button>}
        </div>
        <div className="field-grid">
          <label>
            Nome
            <input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Sigla
            <input value={draft.icon} onChange={event => setDraft(current => ({ ...current, icon: event.target.value.slice(0, 6) }))} />
          </label>
          <label>
            Duracao
            <input type="number" min="10" step="10" value={draft.duration} onChange={event => setDraft(current => ({ ...current, duration: event.target.value }))} />
          </label>
          <label>
            Valor
            <input type="number" min="0" step="5" value={draft.price} onChange={event => setDraft(current => ({ ...current, price: event.target.value }))} />
          </label>
          <label className="toggle-field">
            <input type="checkbox" checked={draft.active} onChange={event => setDraft(current => ({ ...current, active: event.target.checked }))} />
            Ativo para agendamento
          </label>
        </div>
        <button className="button button-primary" type="button" disabled={busy} onClick={() => void save()}>
          {editingId ? 'Salvar alteracoes' : 'Criar servico'}
        </button>
      </article>

      <section className="catalog-grid">
        {services.map(service => (
          <article key={service.id} className="catalog-card">
            <div className="catalog-code">{service.icon || service.name.slice(0, 2).toUpperCase()}</div>
            <div className="catalog-main">
              <strong>{service.name}</strong>
              <p>{service.duration} min - {money(service.price)}</p>
            </div>
            <div className="badge-row">
              <span className={service.active ? 'pill pill-paid' : 'pill pill-cancelled'}>{service.active ? 'Ativo' : 'Inativo'}</span>
            </div>
            <button className="button button-secondary" type="button" onClick={() => startEdit(service)}>Editar</button>
          </article>
        ))}
      </section>
    </section>
  );
};

const ClientsTab = ({ clients, token, onRefresh, onFeedback }: { clients: Client[]; token: string; onRefresh: () => Promise<void>; onFeedback: (message: string, tone: ToastTone) => void }) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClientDraft>(emptyClientDraft());
  const [busy, setBusy] = useState(false);

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter(client => `${client.name} ${client.phone} ${client.email} ${client.notes}`.toLowerCase().includes(query));
  }, [clients, search]);

  const editClient = (client: Client) => {
    setEditingId(client.id);
    setDraft({
      name: client.name,
      phone: client.phone,
      email: client.email,
      notes: client.notes,
    });
  };

  const reset = () => {
    setEditingId(null);
    setDraft(emptyClientDraft());
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        name: draft.name.trim(),
        phone: normalizePhoneInput(draft.phone),
        email: draft.email.trim(),
        notes: draft.notes.trim(),
      };
      if (editingId) {
        await api.updateClient(editingId, payload, token);
        onFeedback('Cliente atualizado', 'success');
      } else {
        await api.createClient(payload, token);
        onFeedback('Cliente criado', 'success');
      }
      reset();
      await onRefresh();
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'Falha ao salvar cliente', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tab-layout">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Cadastro</span>
            <h2>{editingId ? 'Editar cliente' : 'Novo cliente'}</h2>
          </div>
          {editingId && <button className="button button-secondary" type="button" onClick={reset}>Novo</button>}
        </div>
        <div className="field-grid">
          <label>
            Nome
            <input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Telefone
            <input value={draft.phone} onChange={event => setDraft(current => ({ ...current, phone: normalizePhoneInput(event.target.value) }))} />
          </label>
          <label>
            E-mail
            <input value={draft.email} onChange={event => setDraft(current => ({ ...current, email: event.target.value }))} />
          </label>
          <label className="field-span-2">
            Observacoes
            <textarea value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} />
          </label>
        </div>
        <button className="button button-primary" type="button" disabled={busy} onClick={() => void save()}>
          {editingId ? 'Salvar cliente' : 'Criar cliente'}
        </button>
      </article>

      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Base</span>
            <h2>Clientes</h2>
          </div>
          <label className="search-field">
            Buscar
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, telefone ou nota" />
          </label>
        </div>
        {!visibleClients.length && <EmptyState title="Nenhum cliente" text="Cadastre clientes para manter historico e recorrencia." />}
        <div className="list-grid">
          {visibleClients.map(client => (
            <article key={client.id} className="list-card">
              <div className="list-card-main">
                <strong>{client.name}</strong>
                <p>{client.phone || 'Sem telefone'}{client.email ? ` - ${client.email}` : ''}</p>
                {client.notes && <small>{client.notes}</small>}
              </div>
              <button className="button button-secondary" type="button" onClick={() => editClient(client)}>Editar</button>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
};

const AvailabilityTab = ({
  professional,
  blocks,
  token,
  onRefresh,
  onFeedback,
  selectedDate,
}: {
  professional: Staff | null;
  blocks: Block[];
  token: string;
  onRefresh: () => Promise<void>;
  onFeedback: (message: string, tone: ToastTone) => void;
  selectedDate: string;
}) => {
  const [draft, setDraft] = useState<BlockDraft>({ date: selectedDate, start: '12:00', end: '13:00', reason: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(current => ({ ...current, date: selectedDate }));
  }, [selectedDate]);

  const sortedBlocks = useMemo(() => [...blocks].sort((left, right) => left.date.localeCompare(right.date) || left.start.localeCompare(right.start)), [blocks]);

  const save = async () => {
    if (!professional) {
      onFeedback('Configure a profissional principal primeiro', 'error');
      return;
    }

    setBusy(true);
    try {
      await api.createBlock({ ...draft, staffId: professional.id }, token);
      setDraft(current => ({ ...current, start: '12:00', end: '13:00', reason: '' }));
      onFeedback('Bloqueio salvo', 'success');
      await onRefresh();
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'Falha ao salvar bloqueio', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (blockId: string) => {
    setBusy(true);
    try {
      await api.deleteBlock(blockId, token);
      onFeedback('Bloqueio removido', 'success');
      await onRefresh();
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'Falha ao remover bloqueio', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tab-layout">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Disponibilidade</span>
            <h2>Novo bloqueio</h2>
          </div>
        </div>
        {!professional ? <EmptyState title="Sem profissional" text="Cadastre a profissional para liberar esta area." /> : (
          <>
            <div className="field-grid">
              <label>
                Data
                <input type="date" value={draft.date} onChange={event => setDraft(current => ({ ...current, date: event.target.value }))} />
              </label>
              <label>
                Inicio
                <input type="time" value={draft.start} onChange={event => setDraft(current => ({ ...current, start: event.target.value }))} />
              </label>
              <label>
                Fim
                <input type="time" value={draft.end} onChange={event => setDraft(current => ({ ...current, end: event.target.value }))} />
              </label>
              <label className="field-span-2">
                Motivo
                <textarea value={draft.reason} onChange={event => setDraft(current => ({ ...current, reason: event.target.value }))} placeholder="Almoco, curso, pausa" />
              </label>
            </div>
            <button className="button button-primary" type="button" disabled={busy} onClick={() => void save()}>Salvar bloqueio</button>
          </>
        )}
      </article>

      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Agenda travada</span>
            <h2>Bloqueios registrados</h2>
          </div>
        </div>
        {!sortedBlocks.length && <EmptyState title="Sem bloqueios" text="A agenda esta aberta para novos encaixes." />}
        <div className="list-grid">
          {sortedBlocks.map(block => (
            <article key={block.id} className="list-card">
              <div className="list-card-main">
                <strong>{formatDateLabel(block.date)}</strong>
                <p>{block.start} - {block.end}</p>
                {block.reason && <small>{block.reason}</small>}
              </div>
              <button className="button button-secondary" type="button" disabled={busy} onClick={() => void remove(block.id)}>Remover</button>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
};

const ProfileTab = ({
  staff,
  token,
  onRefresh,
  onFeedback,
}: {
  staff: Staff[];
  token: string;
  onRefresh: () => Promise<void>;
  onFeedback: (message: string, tone: ToastTone) => void;
}) => {
  const primary = useMemo(() => getPrimaryStaff(staff), [staff]);
  const [draft, setDraft] = useState<ProfessionalDraft>(emptyProfessionalDraft());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(primary ? {
      name: primary.name,
      phone: primary.phone,
      color: primary.color || '#c26549',
    } : emptyProfessionalDraft());
  }, [primary]);

  const save = async () => {
    setBusy(true);
    try {
      if (primary) {
        await api.updateStaff(primary.id, draft, token);
        onFeedback('Profissional atualizada', 'success');
      } else {
        await api.createStaff({ ...draft, active: true }, token);
        onFeedback('Profissional criada', 'success');
      }
      await onRefresh();
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'Falha ao salvar profissional', 'error');
    } finally {
      setBusy(false);
    }
  };

  const setSingleMode = async (targetId: string) => {
    setBusy(true);
    try {
      await Promise.all(staff.map(item => api.updateStaff(item.id, { active: item.id === targetId }, token)));
      onFeedback('Agenda configurada para uma profissional', 'success');
      await onRefresh();
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'Falha ao ajustar equipe', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tab-layout">
      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Profissional principal</span>
            <h2>{primary ? 'Editar perfil' : 'Criar profissional'}</h2>
          </div>
        </div>
        <div className="field-grid">
          <label>
            Nome
            <input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Telefone
            <input value={draft.phone} onChange={event => setDraft(current => ({ ...current, phone: normalizePhoneInput(event.target.value) }))} />
          </label>
          <label>
            Cor da agenda
            <input type="color" value={draft.color} onChange={event => setDraft(current => ({ ...current, color: event.target.value }))} />
          </label>
        </div>
        <button className="button button-primary" type="button" disabled={busy} onClick={() => void save()}>
          {primary ? 'Salvar perfil' : 'Criar profissional'}
        </button>
      </article>

      <article className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Modo agenda unica</span>
            <h2>Equipe cadastrada</h2>
          </div>
        </div>
        {!staff.length && <EmptyState title="Sem equipe" text="Crie a primeira profissional para ativar a agenda." />}
        <div className="list-grid">
          {staff.map(item => (
            <article key={item.id} className="list-card">
              <div className="list-card-main">
                <strong>{item.name}</strong>
                <p>{item.phone || 'Sem telefone'}</p>
                <div className="badge-row">
                  <span className={item.active ? 'pill pill-paid' : 'pill pill-cancelled'}>{item.active ? 'Ativa' : 'Inativa'}</span>
                </div>
              </div>
              <button className="button button-secondary" type="button" disabled={busy || item.active} onClick={() => void setSingleMode(item.id)}>
                Tornar principal
              </button>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
};

const OwnerWorkspace = ({ session, onLogout }: { session: OwnerSession; onLogout: () => void }) => {
  const toasts = useToasts();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<OwnerTab>('agenda');
  const [agendaMode, setAgendaMode] = useState<AgendaMode>('day');
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [statusFilter, setStatusFilter] = useState<'all' | AppointmentStatus>('all');
  const [search, setSearch] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [quickBooking, setQuickBooking] = useState<QuickBookingDraft>(emptyQuickBookingDraft());
  const [rescheduleAppointmentId, setRescheduleAppointmentId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(todayIso());
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [busyAction, setBusyAction] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [serviceRows, staffRows, clientRows, appointmentRows] = await Promise.all([
        api.getServices(true),
        api.getStaff(true),
        api.getClients(session.token),
        api.getAppointments({}, { ownerToken: session.token }),
      ]);

      const sortedAppointments = [...appointmentRows].sort(sortAppointments);
      const activeRows = staffRows.filter(item => item.active);
      const professional = getPrimaryStaff(activeRows.length ? activeRows : staffRows);
      const blockRows = professional ? await api.getBlocks(professional.id) : [];

      setServices(serviceRows);
      setStaff(staffRows);
      setClients(clientRows);
      setAppointments(sortedAppointments);
      setBlocks(blockRows);
      setQuickBooking(current => ({
        ...current,
        serviceId: current.serviceId || serviceRows.find(item => item.active)?.id || '',
      }));
    } catch (error) {
      toasts.push(error instanceof Error ? error.message : 'Falha ao carregar painel', 'error');
    } finally {
      setLoading(false);
    }
  }, [session.token, toasts.push]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeStaff = useMemo(() => staff.filter(item => item.active), [staff]);
  const professional = useMemo(() => getPrimaryStaff(activeStaff.length ? activeStaff : staff), [activeStaff, staff]);
  const ownerAppointments = useMemo(() => appointments.filter(item => !professional || item.staffId === professional.id || !item.staffId), [appointments, professional]);
  const ownerBlocks = useMemo(() => blocks.filter(item => !professional || item.staffId === professional.id), [blocks, professional]);
  const currentWeek = useMemo(() => weekDates(selectedDate), [selectedDate]);
  const weekStart = useMemo(() => startOfWeekIso(selectedDate), [selectedDate]);
  const weekEnd = useMemo(() => addDaysIso(weekStart, 6), [weekStart]);
  const weekAppointments = useMemo(() => ownerAppointments.filter(item => item.date >= weekStart && item.date <= weekEnd), [ownerAppointments, weekEnd, weekStart]);
  const weekBlocks = useMemo(() => ownerBlocks.filter(item => item.date >= weekStart && item.date <= weekEnd), [ownerBlocks, weekEnd, weekStart]);
  const appointmentsOnDate = useMemo(() => ownerAppointments.filter(item => item.date === selectedDate), [ownerAppointments, selectedDate]);
  const filteredAppointments = useMemo(() => appointmentsOnDate.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return appointmentMatchesSearch(item, search);
  }), [appointmentsOnDate, search, statusFilter]);
  const blocksOnDate = useMemo(() => ownerBlocks.filter(item => item.date === selectedDate), [ownerBlocks, selectedDate]);
  const nextAgendaItem = useMemo(() => nextAppointment(ownerAppointments), [ownerAppointments]);
  const rescheduleAppointment = useMemo(
    () => ownerAppointments.find(item => item.id === rescheduleAppointmentId) || null,
    [ownerAppointments, rescheduleAppointmentId],
  );

  const metrics = useMemo(() => {
    const activeAppointments = ownerAppointments.filter(item => item.status !== 'cancelled');
    const todayAppointments = appointmentsOnDate.filter(item => item.status !== 'cancelled');
    return {
      total: activeAppointments.length,
      pending: todayAppointments.filter(item => item.status === 'pending').length,
      confirmed: todayAppointments.filter(item => item.status === 'confirmed').length,
      revenue: todayAppointments.reduce((sum, item) => sum + item.servicePrice, 0),
      clients: clients.length,
    };
  }, [appointmentsOnDate, clients.length, ownerAppointments]);
  const agendaSnapshot = useMemo(() => {
    const visibleAppointments = filteredAppointments.filter(item => item.status !== 'cancelled');
    const nextVisible = visibleAppointments[0] || null;
    return [
      {
        label: 'Data',
        value: selectedDate.split('-').reverse().join('/'),
        helper: agendaMode === 'day' ? 'Dia em foco' : 'Semana em foco',
      },
      {
        label: 'Na agenda',
        value: visibleAppointments.length,
        helper: 'Horarios visiveis',
      },
      {
        label: 'Bloqueios',
        value: blocksOnDate.length,
        helper: blocksOnDate.length ? 'Periodos fechados' : 'Sem bloqueios',
      },
      {
        label: 'Proximo',
        value: nextVisible ? nextVisible.time : 'Livre',
        helper: nextVisible ? nextVisible.clientName : 'Sem atendimento',
      },
    ];
  }, [agendaMode, blocksOnDate.length, filteredAppointments, selectedDate]);

  const slotsForQuickBooking = useMemo(() => {
    const selectedService = services.find(item => item.id === quickBooking.serviceId);
    if (!selectedService) return [];
    return availableSlotsForDay(appointmentsOnDate, blocksOnDate, selectedDate, selectedService.duration);
  }, [appointmentsOnDate, blocksOnDate, quickBooking.serviceId, selectedDate, services]);
  const rescheduleSlots = useMemo(() => {
    if (!rescheduleAppointment) return [];
    const sameDayAppointments = ownerAppointments.filter(item => item.id !== rescheduleAppointment.id && item.date === rescheduleDate);
    const sameDayBlocks = ownerBlocks.filter(item => item.date === rescheduleDate);
    return availableSlotsForDay(sameDayAppointments, sameDayBlocks, rescheduleDate, rescheduleAppointment.serviceDuration);
  }, [ownerAppointments, ownerBlocks, rescheduleAppointment, rescheduleDate]);

  const runAppointmentAction = async (appointmentId: string, payload: Partial<{ status: AppointmentStatus; paymentStatus: PaymentStatus }>, successMessage: string) => {
    setBusyAction(true);
    try {
      await api.updateAppointment(appointmentId, payload, { ownerToken: session.token });
      toasts.push(successMessage, 'success');
      await load();
    } catch (error) {
      toasts.push(error instanceof Error ? error.message : 'Falha ao atualizar agenda', 'error');
    } finally {
      setBusyAction(false);
    }
  };

  const openReschedule = (appointment: Appointment) => {
    setRescheduleAppointmentId(appointment.id);
    setRescheduleDate(appointment.date);
    setRescheduleTime(appointment.time);
  };

  const clearReschedule = () => {
    setRescheduleAppointmentId(null);
    setRescheduleDate(selectedDate);
    setRescheduleTime('');
  };

  const saveReschedule = async () => {
    if (!rescheduleAppointment || !rescheduleDate || !rescheduleTime) {
      toasts.push('Escolha a nova data e horario', 'error');
      return;
    }

    setBusyAction(true);
    try {
      await api.updateAppointment(
        rescheduleAppointment.id,
        { date: rescheduleDate, time: rescheduleTime },
        { ownerToken: session.token },
      );
      toasts.push('Horario remarcado', 'success');
      clearReschedule();
      if (agendaMode === 'day') {
        setSelectedDate(rescheduleDate);
      }
      await load();
    } catch (error) {
      toasts.push(error instanceof Error ? error.message : 'Falha ao remarcar', 'error');
    } finally {
      setBusyAction(false);
    }
  };

  const createQuickBooking = async () => {
    if (!professional) {
      toasts.push('Configure a profissional principal primeiro', 'error');
      return;
    }
    if (!quickBooking.clientName.trim() || !quickBooking.clientPhone.trim() || !quickBooking.serviceId || !quickBooking.time) {
      toasts.push('Preencha cliente, telefone, servico e horario', 'error');
      return;
    }

    setBusyAction(true);
    try {
      const client = await api.upsertClientContact({
        name: quickBooking.clientName.trim(),
        phone: normalizePhoneInput(quickBooking.clientPhone),
      }, session.token);
      await api.createAppointment({
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        serviceId: quickBooking.serviceId,
        staffId: professional.id,
        date: selectedDate,
        time: quickBooking.time,
        notes: quickBooking.notes.trim(),
        status: 'confirmed',
      }, { ownerToken: session.token });
      setQuickBooking({ ...emptyQuickBookingDraft(), serviceId: quickBooking.serviceId });
      toasts.push('Encaixe criado na agenda', 'success');
      await load();
    } catch (error) {
      toasts.push(error instanceof Error ? error.message : 'Falha ao criar encaixe', 'error');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <main className="page">
      <ToastViewport items={toasts.items} onDismiss={toasts.dismiss} />
      <section className="app-shell">
        <header className="topbar topbar-owner">
          <div className="topbar-main">
            <HeaderIdentity
              eyebrow="Painel da gestora"
              title="Operacao da agenda"
              subtitle={`${session.salon || BRAND_NAME} com agenda visual, encaixes e relacionamento em um unico painel.`}
            />
            <div className="topbar-tag-row">
              <span className="topbar-tag">Agenda unica</span>
              <span className="topbar-tag topbar-tag-muted">{professional?.name || 'Profissional nao definida'}</span>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="button button-secondary" type="button" onClick={() => void load()}>Atualizar</button>
            <button className="button button-primary" type="button" onClick={onLogout}>Sair</button>
          </div>
        </header>

        <section className="owner-hero">
          <article className="owner-hero-card">
            <div>
              <span className="eyebrow">Controle diario</span>
              <h2>Agenda visual para confirmar, remarcar e atender com clareza.</h2>
            </div>
            <div className="owner-hero-actions">
              <button className="button button-primary" type="button" onClick={() => { setTab('agenda'); setAgendaMode('day'); setStatusFilter('pending'); setSelectedDate(todayIso()); setSearch(''); }}>Ver pendentes</button>
              <button className="button button-secondary" type="button" onClick={() => { setTab('availability'); setSelectedDate(todayIso()); }}>Bloquear horario</button>
            </div>
          </article>
          <article className="owner-hero-card compact">
            <span className="eyebrow">Profissional principal</span>
            <h3>{professional?.name || 'Nao configurada'}</h3>
            <p>{activeStaff.length > 1 ? 'Ha mais de uma profissional ativa. Deixe apenas uma no perfil.' : 'Modo agenda unica ativo.'}</p>
          </article>
        </section>

        <section className="metric-grid metric-grid-owner">
          <MetricCard label="Agenda ativa" value={metrics.total} helper="Atendimentos nao cancelados" />
          <MetricCard label="Pendentes hoje" value={metrics.pending} helper="Esperando confirmacao" />
          <MetricCard label="Confirmados hoje" value={metrics.confirmed} helper="Atendimentos validados" />
          <MetricCard label="Receita do dia" value={money(metrics.revenue)} helper={nextAgendaItem ? `Proximo: ${nextAgendaItem.clientName} as ${nextAgendaItem.time}` : 'Sem proximo horario'} />
        </section>

        <nav className="tabbar">
          {[
            ['agenda', 'Agenda'],
            ['services', 'Servicos'],
            ['clients', 'Clientes'],
            ['availability', 'Disponibilidade'],
            ['profile', 'Perfil'],
          ].map(([value, label]) => (
            <button key={value} type="button" className={tab === value ? 'active' : ''} onClick={() => setTab(value as OwnerTab)}>{label}</button>
          ))}
        </nav>

        {loading ? <EmptyState title="Carregando painel" text="Buscando dados da agenda." /> : (
          <>
            {tab === 'agenda' && (
              <section className="agenda-layout">
                <div className="agenda-main-grid">
                  <div className="agenda-primary">
                    <article className="panel filter-panel">
                      <div className="panel-head">
                        <div>
                          <span className="eyebrow">Agenda do gestor</span>
                          <h2>Agenda operacional</h2>
                        </div>
                        <div className="mode-switch">
                          <button type="button" className={agendaMode === 'day' ? 'active' : ''} onClick={() => setAgendaMode('day')}>Dia</button>
                          <button type="button" className={agendaMode === 'week' ? 'active' : ''} onClick={() => setAgendaMode('week')}>Semana</button>
                        </div>
                      </div>
                      <div className="field-grid compact-grid">
                        <label>
                          Data
                          <input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} />
                        </label>
                        <label>
                          Status
                          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | AppointmentStatus)}>
                            <option value="all">Todos</option>
                            <option value="pending">Pendentes</option>
                            <option value="confirmed">Confirmados</option>
                            <option value="done">Concluidos</option>
                            <option value="cancelled">Cancelados</option>
                          </select>
                        </label>
                        <label className="field-span-2">
                          Buscar
                          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cliente, telefone ou servico" />
                        </label>
                      </div>
                      <AgendaSnapshot items={agendaSnapshot} />
                    </article>

                    {agendaMode === 'day' ? (
                      <ScheduleBoard professional={professional} appointments={filteredAppointments} blocks={blocksOnDate} />
                    ) : (
                      <WeekBoard
                        week={currentWeek}
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                        appointments={weekAppointments.filter(item => statusFilter === 'all' || item.status === statusFilter).filter(item => appointmentMatchesSearch(item, search))}
                        blocks={weekBlocks}
                      />
                    )}
                  </div>

                  <aside className="agenda-sidebar">
                    <article className="panel quick-panel">
                      <div className="panel-head">
                        <div>
                          <span className="eyebrow">Encaixe rapido</span>
                          <h2>Novo horario manual</h2>
                        </div>
                      </div>
                      <div className="field-grid">
                        <label>
                          Cliente
                          <input value={quickBooking.clientName} onChange={event => setQuickBooking(current => ({ ...current, clientName: event.target.value }))} />
                        </label>
                        <label>
                          Telefone
                          <input value={quickBooking.clientPhone} onChange={event => setQuickBooking(current => ({ ...current, clientPhone: normalizePhoneInput(event.target.value) }))} />
                        </label>
                        <label>
                          Servico
                          <select value={quickBooking.serviceId} onChange={event => setQuickBooking(current => ({ ...current, serviceId: event.target.value, time: '' }))}>
                            <option value="">Selecione</option>
                            {services.filter(item => item.active).map(service => (
                              <option key={service.id} value={service.id}>{service.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Horario
                          <select value={quickBooking.time} onChange={event => setQuickBooking(current => ({ ...current, time: event.target.value }))}>
                            <option value="">Selecione</option>
                            {slotsForQuickBooking.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                          </select>
                        </label>
                        <label className="field-span-2">
                          Observacoes
                          <textarea value={quickBooking.notes} onChange={event => setQuickBooking(current => ({ ...current, notes: event.target.value }))} />
                        </label>
                      </div>
                      <button className="button button-primary button-block" type="button" disabled={busyAction} onClick={() => void createQuickBooking()}>Adicionar na agenda</button>
                    </article>

                    <article className="panel agenda-note-panel">
                      <div className="panel-head">
                        <div>
                          <span className="eyebrow">Visao rapida</span>
                          <h2>Resumo operacional</h2>
                        </div>
                      </div>
                      <div className="agenda-note-stack">
                        <div className="agenda-note">
                          <strong>{professional?.name || 'Profissional nao definida'}</strong>
                          <p>{activeStaff.length > 1 ? 'Revise o perfil e deixe apenas uma profissional ativa.' : 'Modo agenda unica ativo para a operacao.'}</p>
                        </div>
                        <div className="agenda-note">
                          <strong>{agendaMode === 'day' ? 'Dia em foco' : 'Semana em foco'}</strong>
                          <p>{agendaMode === 'day' ? `${filteredAppointments.length} atendimento(s) visiveis para a data selecionada.` : `${weekAppointments.length} atendimento(s) dentro da semana atual.`}</p>
                        </div>
                      </div>
                    </article>
                  </aside>
                </div>

                <article className="panel agenda-list-panel">
                  <div className="panel-head">
                    <div>
                      <span className="eyebrow">Fila do dia</span>
                      <h2>Atendimentos</h2>
                    </div>
                  </div>
                  {!filteredAppointments.length && <EmptyState title="Dia livre" text="Nenhum atendimento encontrado para os filtros atuais." />}
                  <div className="list-grid">
                    {filteredAppointments.map(appointment => (
                      <article key={appointment.id} className="list-card agenda-card">
                        <div className="list-card-main">
                          <strong>{appointment.time} - {appointment.clientName}</strong>
                          <p>{appointment.serviceName} - {money(appointment.servicePrice)}</p>
                          <small>{appointment.clientPhone}</small>
                          <div className="badge-row">
                            <StatusBadge status={appointment.status} />
                            <PaymentBadge status={appointment.paymentStatus} />
                          </div>
                        </div>
                        <div className="action-group">
                          <button className="button button-secondary" type="button" disabled={busyAction || appointment.status === 'confirmed'} onClick={() => void runAppointmentAction(appointment.id, { status: 'confirmed' }, 'Agendamento confirmado')}>Confirmar</button>
                          <button className="button button-secondary" type="button" disabled={busyAction || appointment.status === 'done'} onClick={() => void runAppointmentAction(appointment.id, { status: 'done' }, 'Atendimento concluido')}>Concluir</button>
                          <button className="button button-secondary" type="button" disabled={busyAction} onClick={() => openReschedule(appointment)}>Remarcar</button>
                          <button className="button button-secondary" type="button" disabled={busyAction || appointment.paymentStatus === 'paid'} onClick={() => void runAppointmentAction(appointment.id, { paymentStatus: 'paid' }, 'Pagamento registrado')}>Pago</button>
                          <button className="button button-secondary" type="button" disabled={busyAction || appointment.status === 'cancelled'} onClick={() => void runAppointmentAction(appointment.id, { status: 'cancelled' }, 'Agendamento cancelado')}>Cancelar</button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {rescheduleAppointment && (
                    <div className="reschedule-panel">
                      <div className="reschedule-head">
                        <div>
                          <span className="eyebrow">Remarcacao</span>
                          <strong>{rescheduleAppointment.clientName} - {rescheduleAppointment.serviceName}</strong>
                        </div>
                        <button className="button button-secondary" type="button" disabled={busyAction} onClick={clearReschedule}>Fechar</button>
                      </div>
                      <div className="field-grid compact-grid">
                        <label>
                          Nova data
                          <input type="date" value={rescheduleDate} onChange={event => { setRescheduleDate(event.target.value); setRescheduleTime(''); }} />
                        </label>
                        <label>
                          Novo horario
                          <select value={rescheduleTime} onChange={event => setRescheduleTime(event.target.value)}>
                            <option value="">Selecione</option>
                            {rescheduleSlots.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                          </select>
                        </label>
                      </div>
                      {!rescheduleSlots.length && <small className="muted-text">Nao ha horarios livres para a data escolhida.</small>}
                      <div className="action-group">
                        <button className="button button-primary" type="button" disabled={busyAction || !rescheduleTime} onClick={() => void saveReschedule()}>Salvar novo horario</button>
                      </div>
                    </div>
                  )}
                </article>
              </section>
            )}

            {tab === 'services' && (
              <ServicesTab services={services} token={session.token} onRefresh={load} onFeedback={toasts.push} />
            )}

            {tab === 'clients' && (
              <ClientsTab clients={clients} token={session.token} onRefresh={load} onFeedback={toasts.push} />
            )}

            {tab === 'availability' && (
              <AvailabilityTab professional={professional} blocks={ownerBlocks} token={session.token} onRefresh={load} onFeedback={toasts.push} selectedDate={selectedDate} />
            )}

            {tab === 'profile' && (
              <ProfileTab staff={staff} token={session.token} onRefresh={load} onFeedback={toasts.push} />
            )}
          </>
        )}
      </section>
    </main>
  );
};

export default function App() {
  const [session, setSession] = useState<Session | null>(() => readStoredSession());

  const handleLogin = (nextSession: Session) => {
    setSession(nextSession);
  };

  const handleLogout = () => {
    storeSession(null);
    setSession(null);
  };

  useEffect(() => {
    if (!session) return undefined;

    const handleUnauthorized = () => {
      storeSession(null);
      setSession(null);
    };

    window.addEventListener('app:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('app:unauthorized', handleUnauthorized);
  }, [session]);

  if (!session) {
    return <LandingPage onLogin={handleLogin} />;
  }

  if (session.role === 'owner') {
    return <OwnerWorkspace session={session} onLogout={handleLogout} />;
  }

  return <ClientWorkspace session={session} onLogout={handleLogout} />;
}
