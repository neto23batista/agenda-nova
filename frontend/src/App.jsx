// ═══════════════════════════════════════════════════════════════
//  Belle Studio — Frontend React com integração à API REST
// ═══════════════════════════════════════════════════════════════
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

const API_BASE = "http://localhost:3001/api";

// ── API Client ────────────────────────────────────────────────

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro desconhecido");
  return data;
}

// ── Design tokens ────────────────────────────────────────────
const T = {
  bg:"#fdf8f5", surface:"#ffffff", border:"#edddd4",
  text:"#2d1f17", muted:"#9a7b6e", accent:"#b5533c", accent2:"#d4846e",
  gold:"#c49a3c", green:"#3c8c5a", red:"#b53c3c", blue:"#3c6eb5", wapp:"#25d366",
};

const css = {
  card:  { background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"20px 24px", boxShadow:"0 2px 12px rgba(45,31,23,0.06)" },
  input: { width:"100%", boxSizing:"border-box", background:"#fdf8f5", border:`1.5px solid ${T.border}`, borderRadius:10, padding:"11px 14px", color:T.text, fontSize:14, outline:"none", fontFamily:"inherit", transition:"border-color .2s" },
  label: { display:"block", fontSize:11, color:T.muted, marginBottom:6, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" },
};

const fmtDate = (d) => { if(!d)return""; const[y,m,day]=d.split("-"); return`${day}/${m}/${y}`; };
const todayStr = () => new Date().toISOString().split("T")[0];
const uid      = () => Math.random().toString(36).slice(2, 9);
const timeAgo  = (iso) => { const s=Math.floor((Date.now()-new Date(iso))/1000); if(s<60)return"agora"; if(s<3600)return`${Math.floor(s/60)}min`; if(s<86400)return`${Math.floor(s/3600)}h`; return`${Math.floor(s/86400)}d`; };
const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const getDaysInMonth = (y,m) => new Date(y,m+1,0).getDate();
const getFirstDay    = (y,m) => new Date(y,m,1).getDay();

// ── Primitives ────────────────────────────────────────────────

function Field({ label, error, children }) {
  return <div style={{marginBottom:16}}>{label&&<label style={css.label}>{label}</label>}{children}{error&&<div style={{fontSize:11,color:T.red,marginTop:4}}>{error}</div>}</div>;
}
function Inp({ label, error, ...p }) {
  return <Field label={label} error={error}><input {...p} style={{...css.input,...(p.style||{}),borderColor:error?T.red:T.border}} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=error?T.red:T.border}/></Field>;
}
function Sel({ label, children, ...p }) {
  return <Field label={label}><select {...p} style={{...css.input,appearance:"none"}}>{children}</select></Field>;
}
function Btn({ children, variant="primary", size="md", style:s, ...p }) {
  const sz={sm:"7px 14px",md:"10px 20px",lg:"14px 28px"};
  const fsz={sm:12,md:13,lg:15};
  const v={primary:{background:T.accent,color:"#fff",border:"none"},gold:{background:T.gold,color:"#fff",border:"none"},danger:{background:T.red,color:"#fff",border:"none"},ghost:{background:"transparent",color:T.muted,border:`1px solid ${T.border}`},green:{background:T.green,color:"#fff",border:"none"},wapp:{background:T.wapp,color:"#fff",border:"none"},blue:{background:T.blue,color:"#fff",border:"none"},outline:{background:"transparent",color:T.accent,border:`1.5px solid ${T.accent}`}};
  return <button {...p} style={{border:"none",borderRadius:10,cursor:"pointer",fontWeight:700,fontFamily:"inherit",transition:"all .18s",display:"inline-flex",alignItems:"center",gap:6,padding:sz[size],fontSize:fsz[size],...v[variant],...s}} onMouseEnter={e=>{e.currentTarget.style.opacity=".85";e.currentTarget.style.transform="translateY(-1px)";}} onMouseLeave={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.transform="translateY(0)"}}>{children}</button>;
}
function Modal({ open, onClose, title, width=520, children }) {
  if(!open)return null;
  return <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(45,31,23,0.45)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}><div style={{...css.card,width:"100%",maxWidth:width,maxHeight:"90vh",overflowY:"auto",padding:"28px 32px"}} onClick={e=>e.stopPropagation()}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><h3 style={{margin:0,fontSize:18,fontWeight:800,color:T.text}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:T.muted}}>×</button></div>{children}</div></div>;
}
function Toasts({ items }) {
  const bg={success:T.green,error:T.red,warn:T.gold,wapp:T.wapp,email:T.blue};
  const ic={success:"✅",error:"❌",warn:"⚠️",wapp:"📱",email:"📧"};
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>{items.map(t=><div key={t.id} style={{background:bg[t.type]||T.green,color:"#fff",padding:"12px 20px",borderRadius:12,fontWeight:700,fontSize:13,boxShadow:"0 8px 24px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",gap:8}}>{ic[t.type]||"✅"} {t.msg}</div>)}</div>;
}
function StatusBadge({ status }) {
  const m={confirmed:{l:"Confirmado",bg:T.green},pending:{l:"Pendente",bg:T.gold},cancelled:{l:"Cancelado",bg:T.red},done:{l:"Concluído",bg:T.blue},consent_pending:{l:"Aguard. Consentimento",bg:"#8c5a3c"}};
  const s=m[status]||m.pending;
  return <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,color:"#fff",background:s.bg}}>{s.l}</span>;
}
function useToast() {
  const [toasts,setToasts]=useState([]);
  const show=useCallback((msg,type="success")=>{const id=uid();setToasts(p=>[...p,{id,msg,type}]);setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3500);},[]);
  return{toasts,show};
}
function Spinner() {
  return <div style={{textAlign:"center",padding:"60px 20px",color:T.muted}}>⏳ Carregando...</div>;
}
function ApiError({ error }) {
  return <div style={{background:"#fff0f0",border:`1px solid ${T.red}`,borderRadius:12,padding:"16px 20px",color:T.red,fontWeight:700,marginBottom:16}}>❌ {error}</div>;
}

// ── Calendar ─────────────────────────────────────────────────

function MiniCalendar({ selected, onSelect, appointments }) {
  const [vd,setVd]=useState(()=>{const n=new Date();return{y:n.getFullYear(),m:n.getMonth()};});
  const{y,m}=vd;
  const cells=[...Array(getFirstDay(y,m)).fill(null),...Array.from({length:getDaysInMonth(y,m)},(_,i)=>i+1)];
  const dots=(day)=>{const ds=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;return appointments.filter(a=>a.date===ds&&a.status!=="cancelled").length;};
  return <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:16}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <button onClick={()=>setVd(v=>{let nm=v.m-1,ny=v.y;if(nm<0){nm=11;ny--;}return{y:ny,m:nm};})} style={{background:"none",border:"none",color:T.muted,fontSize:18,cursor:"pointer"}}>‹</button>
      <span style={{fontWeight:800,color:T.text,fontSize:14}}>{monthNames[m].slice(0,3)} {y}</span>
      <button onClick={()=>setVd(v=>{let nm=v.m+1,ny=v.y;if(nm>11){nm=0;ny++;}return{y:ny,m:nm};})} style={{background:"none",border:"none",color:T.muted,fontSize:18,cursor:"pointer"}}>›</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>{["D","S","T","Q","Q","S","S"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,color:T.muted,fontWeight:700}}>{d}</div>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
      {cells.map((day,i)=>{if(!day)return<div key={i}/>;const ds=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;const isSel=selected===ds,isToday=ds===todayStr(),cnt=dots(day);return<button key={i} onClick={()=>onSelect(ds)} style={{position:"relative",textAlign:"center",background:isSel?T.accent:isToday?"#fde8e0":"transparent",border:isToday&&!isSel?`1.5px solid ${T.accent2}`:"1px solid transparent",borderRadius:8,color:isSel?"#fff":T.text,fontWeight:isSel||isToday?800:400,fontSize:12,padding:"5px 2px",cursor:"pointer"}}>{day}{cnt>0&&<span style={{position:"absolute",bottom:2,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:"50%",background:isSel?"#fff":T.accent}}/>}</button>;})}
    </div>
  </div>;
}

// ── Notification Bell ─────────────────────────────────────────

function NotificationBell({ token, onMarkAll }) {
  const [open,setOpen]   = useState(false);
  const [data,setData]   = useState({ notifications:[], unreadCount:0 });
  const [loading,setLoading] = useState(false);
  const ref = useRef();

  const fetchNotifs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try { const d = await api("/notifications?limit=40", { token }); setData(d); }
    catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchNotifs(); const id=setInterval(fetchNotifs,30000); return()=>clearInterval(id); }, [fetchNotifs]);

  useEffect(() => {
    const h=e=>{ if(ref.current&&!ref.current.contains(e.target))setOpen(false); };
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);

  const markAll = async () => {
    try { await api("/notifications/read-all", { method:"PATCH", token }); fetchNotifs(); onMarkAll?.(); } catch {}
  };
  const markOne = async (id) => {
    try { await api(`/notifications/${id}/read`, { method:"PATCH", token }); fetchNotifs(); } catch {}
  };

  return <div ref={ref} style={{position:"relative"}}>
    <button onClick={()=>setOpen(o=>!o)} style={{position:"relative",background:"transparent",border:`1px solid #5a3a2a`,borderRadius:10,color:"#c9a090",padding:"7px 14px",cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:6}}>
      🔔
      {data.unreadCount>0&&<span style={{position:"absolute",top:-7,right:-7,background:T.red,color:"#fff",borderRadius:"50%",width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,border:"2px solid #2d1f17"}}>{data.unreadCount>9?"9+":data.unreadCount}</span>}
    </button>
    {open&&<div style={{position:"absolute",top:"calc(100%+12px)",right:0,zIndex:500,width:380,background:T.surface,border:`1px solid ${T.border}`,borderRadius:18,boxShadow:"0 20px 60px rgba(45,31,23,0.2)",overflow:"hidden"}}>
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fdf8f5"}}>
        <div><span style={{fontWeight:800,color:T.text,fontSize:15}}>🔔 Notificações</span>{data.unreadCount>0&&<span style={{marginLeft:8,background:T.accent,color:"#fff",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:800}}>{data.unreadCount} novas</span>}</div>
        <button onClick={markAll} style={{background:"none",border:"none",fontSize:11,color:T.muted,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>Marcar todas lidas</button>
      </div>
      <div style={{maxHeight:380,overflowY:"auto"}}>
        {loading&&<div style={{padding:20,textAlign:"center",color:T.muted}}>Carregando...</div>}
        {!loading&&data.notifications.length===0&&<div style={{padding:"40px 20px",textAlign:"center",color:T.muted}}><div style={{fontSize:32,marginBottom:8}}>🔕</div>Nenhuma notificação</div>}
        {data.notifications.map(n=><div key={n.id} onClick={()=>markOne(n.id)} style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,cursor:"pointer",background:n.read?"#fff":"#fff8f5"}} onMouseEnter={e=>e.currentTarget.style.background="#fdf0e8"} onMouseLeave={e=>e.currentTarget.style.background=n.read?"#fff":"#fff8f5"}>
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{fontSize:22,flexShrink:0}}>{n.type==="new_booking"?"📅":n.type==="reminder"?"⏰":n.type==="consent_request"?"⚠️":"🔔"}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,color:T.text,fontSize:13,marginBottom:2}}>{n.title}</div>
              <div style={{fontSize:12,color:T.muted,lineHeight:1.5}}>{n.message}</div>
              <div style={{fontSize:10,color:T.muted,marginTop:4,display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:n.read?T.muted:T.accent,display:"inline-block"}}/>{timeAgo(n.created_at)} atrás</div>
            </div>
          </div>
        </div>)}
      </div>
    </div>}
  </div>;
}

// ── Reminders Panel (owner) ───────────────────────────────────

function RemindersPanel({ appointments, token, onToast }) {
  const todayAppts = appointments.filter(a=>a.date===todayStr()&&a.status!=="cancelled");
  const [sending,setSending] = useState({});

  const sendReminder = async (apptId, channel) => {
    setSending(p=>({...p,[`${apptId}-${channel}`]:true}));
    try {
      const res = await api(`/notifications/send-reminder/${apptId}`, { method:"POST", token, body:{channels:[channel]} });
      onToast(`${channel==="whatsapp"?"WhatsApp":"E-mail"} enviado para ${res.client}!`, channel==="whatsapp"?"wapp":"email");
    } catch(e) { onToast(e.message,"error"); }
    finally { setSending(p=>({...p,[`${apptId}-${channel}`]:false})); }
  };

  const sendAll = async (channel) => { for (const a of todayAppts) await sendReminder(a.id, channel); };

  if (todayAppts.length===0) return null;

  return <div style={{...css.card,marginBottom:22,borderLeft:`5px solid ${T.gold}`,padding:"18px 22px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <div>
        <div style={{fontWeight:900,color:T.text,fontSize:16}}>⏰ Lembretes do Dia — {fmtDate(todayStr())}</div>
        <div style={{fontSize:12,color:T.muted,marginTop:2}}>{todayAppts.length} agendamento(s) • Lembretes automáticos via API</div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn variant="wapp" size="sm" onClick={()=>sendAll("whatsapp")}><WappIcon/> WhatsApp p/ Todas</Btn>
        <Btn variant="blue" size="sm" onClick={()=>sendAll("email")}>📧 E-mail p/ Todas</Btn>
      </div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {todayAppts.map(a=>{
        const wKey=`${a.id}-whatsapp`,eKey=`${a.id}-email`;
        return <div key={a.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"10px 14px",background:T.bg,borderRadius:10,borderLeft:`3px solid ${a.professionalColor||T.accent}`,flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:18}}>{a.serviceIcon}</span>
            <div>
              <div style={{fontWeight:800,color:T.text,fontSize:13}}>{a.clientName}</div>
              <div style={{fontSize:11,color:T.muted}}>{a.serviceName} • {a.professionalName} • {a.time}</div>
              <div style={{fontSize:10,color:T.muted}}>{a.clientEmail} • {a.clientPhone}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button disabled={sending[wKey]} onClick={()=>sendReminder(a.id,"whatsapp")} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 13px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",background:T.wapp,color:"#fff",opacity:sending[wKey]?.6:1}}>
              <WappIcon size={12}/>{sending[wKey]?"...":"WhatsApp"}
            </button>
            <button disabled={sending[eKey]} onClick={()=>sendReminder(a.id,"email")} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 13px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",background:T.blue,color:"#fff",opacity:sending[eKey]?.6:1}}>
              📧 {sending[eKey]?"...":"E-mail"}
            </button>
          </div>
        </div>;
      })}
    </div>
  </div>;
}

function WappIcon({size=14}){return<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>;}

// ══════════════════════════════════════════════════════════════
//  AUTH PAGE
// ══════════════════════════════════════════════════════════════

function AuthPage({ onLogin }) {
  const [tab,setTab]   = useState("login");
  const [form,setForm] = useState({name:"",phone:"",email:"",password:"",confirm:""});
  const [errors,setErrors] = useState({});
  const [loading,setLoading] = useState(false);
  const [apiErr,setApiErr]   = useState("");
  const set=(k,v)=>{setForm(f=>({...f,[k]:v}));setErrors(e=>({...e,[k]:""}));setApiErr("");};

  const handleLogin = async () => {
    const errs={};if(!form.email)errs.email="Obrigatório";if(!form.password)errs.password="Obrigatório";
    setErrors(errs);if(Object.keys(errs).length)return;
    setLoading(true);
    try { const res=await api("/auth/login",{method:"POST",body:{email:form.email,password:form.password}});onLogin(res.token,res.user); }
    catch(e){ setApiErr(e.message); }
    finally{ setLoading(false); }
  };

  const handleRegister = async () => {
    const errs={};if(!form.name)errs.name="Obrigatório";if(!form.phone)errs.phone="Obrigatório";if(!form.email)errs.email="E-mail inválido";if(form.password.length<6)errs.password="Mínimo 6 caracteres";if(form.password!==form.confirm)errs.confirm="Senhas diferentes";
    setErrors(errs);if(Object.keys(errs).length)return;
    setLoading(true);
    try { const res=await api("/auth/register",{method:"POST",body:{name:form.name,phone:form.phone,email:form.email,password:form.password}});onLogin(res.token,res.user); }
    catch(e){ setApiErr(e.message); }
    finally{ setLoading(false); }
  };

  return <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Georgia',serif",padding:16,backgroundImage:"radial-gradient(circle at 20% 80%,#f7e8e0 0%,transparent 50%)"}}>
    <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box}`}</style>
    <div style={{width:"100%",maxWidth:430,animation:"fadeIn .5s ease"}}>
      <div style={{textAlign:"center",marginBottom:32}}><div style={{fontSize:52,marginBottom:8}}>💅</div><h1 style={{margin:0,fontSize:32,fontWeight:900,color:T.text}}>Belle Studio</h1><p style={{margin:"6px 0 0",color:T.muted,fontSize:14}}>Sistema de Agendamentos</p></div>
      <div style={css.card}>
        <div style={{display:"flex",gap:4,marginBottom:24,background:T.bg,borderRadius:10,padding:4}}>
          {[["login","Entrar"],["register","Cadastrar-se"]].map(([key,label])=><button key={key} onClick={()=>{setTab(key);setErrors({});setApiErr("");setForm({name:"",phone:"",email:"",password:"",confirm:""}); }} style={{flex:1,padding:"9px 0",borderRadius:8,border:"none",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",background:tab===key?T.surface:"transparent",color:tab===key?T.accent:T.muted,transition:"all .2s"}}>{label}</button>)}
        </div>
        {apiErr&&<ApiError error={apiErr}/>}
        {tab==="login"?<>
          <Inp label="E-mail" type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="seu@email.com" error={errors.email}/>
          <Inp label="Senha" type="password" value={form.password} onChange={e=>set("password",e.target.value)} placeholder="••••••" error={errors.password}/>
          <Btn variant="primary" size="lg" style={{width:"100%",justifyContent:"center",marginTop:4}} onClick={handleLogin} disabled={loading}>{loading?"Entrando...":"Entrar →"}</Btn>
          <div style={{marginTop:16,padding:"12px 14px",background:"#fdf0e8",borderRadius:10,fontSize:12,color:T.muted}}><strong style={{color:T.accent}}>Dono:</strong> dono@belle.com / belle123<br/><strong style={{color:T.accent}}>Cliente:</strong> maria@email.com / 123456</div>
        </>:<>
          <Inp label="Nome *" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Seu nome" error={errors.name}/>
          <Inp label="Celular (com DDD) *" value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="11999990000" error={errors.phone}/>
          <Inp label="E-mail *" type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="seu@email.com" error={errors.email}/>
          <Inp label="Senha *" type="password" value={form.password} onChange={e=>set("password",e.target.value)} placeholder="Mínimo 6 caracteres" error={errors.password}/>
          <Inp label="Confirmar senha *" type="password" value={form.confirm} onChange={e=>set("confirm",e.target.value)} placeholder="Repita" error={errors.confirm}/>
          <Btn variant="primary" size="lg" style={{width:"100%",justifyContent:"center",marginTop:4}} onClick={handleRegister} disabled={loading}>{loading?"Criando conta...":"Criar Conta →"}</Btn>
        </>}
      </div>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════════
//  CLIENT PORTAL
// ══════════════════════════════════════════════════════════════

function ClientPortal({ user, token, onLogout }) {
  const [tab,setTab]           = useState("home");
  const [appointments,setAppts]= useState([]);
  const [services,setServices] = useState([]);
  const [professionals,setProfs]= useState([]);
  const [loading,setLoading]   = useState(true);
  const {toasts,show}          = useToast();

  const load = useCallback(async () => {
    try {
      const [appts,svcs,profs] = await Promise.all([
        api("/appointments", {token}),
        api("/services", {token}),
        api("/professionals", {token}),
      ]);
      setAppts(appts); setServices(svcs); setProfs(profs);
    } catch(e){ show(e.message,"error"); }
    finally{ setLoading(false); }
  }, [token]);

  useEffect(()=>{ load(); },[load]);

  const myAppts   = appointments.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  const upcoming  = myAppts.filter(a=>a.date>=todayStr()&&a.status!=="cancelled"&&a.status!=="done");
  const pendConsent = myAppts.filter(a=>a.consentRequest?.status==="pending");

  const handleBook = async (body) => {
    try {
      await api("/appointments",{method:"POST",token,body});
      show("✅ Agendamento solicitado! O salão confirmará em breve.");
      load(); setTab("my");
    } catch(e){ show(e.message,"error"); }
  };

  const handleCancel = async (id) => {
    try { await api(`/appointments/${id}`,{method:"PATCH",token,body:{status:"cancelled"}}); show("Cancelado.","warn"); load(); }
    catch(e){ show(e.message,"error"); }
  };

  const handleConsent = async (id, accepted) => {
    try { await api(`/appointments/${id}/consent-response`,{method:"POST",token,body:{accepted}}); show(accepted?"✅ Aceito!":"❌ Recusado."); load(); }
    catch(e){ show(e.message,"error"); }
  };

  if(loading) return <Spinner/>;

  return <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Georgia',serif"}}>
    <Toasts items={toasts}/>
    <header style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:62,position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:22}}>💅</span><span style={{fontWeight:900,fontSize:17,color:T.text}}>Belle Studio</span></div>
      <nav style={{display:"flex",gap:4}}>
        {[["home","🏠 Início"],["book","📅 Agendar"],["my",`📋 Agendamentos${pendConsent.length?` (${pendConsent.length}!)`:""}`]].map(([key,label])=><button key={key} onClick={()=>setTab(key)} style={{background:tab===key?T.accent:"transparent",border:tab===key?"none":`1px solid ${T.border}`,borderRadius:8,color:tab===key?"#fff":T.muted,padding:"7px 14px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",transition:"all .2s"}}>{label}</button>)}
      </nav>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:13,color:T.muted}}>Olá, <strong style={{color:T.text}}>{user.name.split(" ")[0]}</strong></span>
        <Btn variant="ghost" size="sm" onClick={onLogout}>Sair</Btn>
      </div>
    </header>
    <main style={{maxWidth:900,margin:"0 auto",padding:"32px 20px"}}>
      {tab==="home"&&<ClientHome upcoming={upcoming} pending={pendConsent} setTab={setTab} services={services}/>}
      {tab==="book"&&<ClientBook user={user} appointments={appointments} services={services} professionals={professionals} onBook={handleBook}/>}
      {tab==="my"&&<ClientMyAppts appts={myAppts} services={services} onCancel={handleCancel} onConsent={handleConsent}/>}
    </main>
  </div>;
}

function ClientHome({upcoming,pending,setTab}){
  return <div style={{animation:"fadeIn .4s ease"}}>
    {pending.length>0&&<div style={{background:"#fff8e8",border:`1.5px solid ${T.gold}`,borderRadius:14,padding:"16px 20px",marginBottom:20}}><div style={{fontWeight:800,color:T.gold,marginBottom:6}}>⚠️ {pending.length} solicitação pendente</div><Btn variant="gold" size="sm" onClick={()=>setTab("my")}>Responder →</Btn></div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:28}}>
      <div style={{...css.card,borderTop:`4px solid ${T.accent}`}}><div style={{fontSize:28,fontWeight:900,color:T.accent}}>{upcoming.length}</div><div style={{fontSize:12,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Próximos agendamentos</div></div>
      <div style={{...css.card,borderTop:`4px solid ${T.green}`,cursor:"pointer"}} onClick={()=>setTab("book")}><div style={{fontSize:28}}>＋</div><div style={{fontSize:12,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Novo agendamento</div></div>
    </div>
    {upcoming.length>0?<>
      <h3 style={{fontWeight:800,color:T.text,fontSize:16,marginBottom:14}}>📅 Próximos</h3>
      {upcoming.slice(0,3).map(a=><div key={a.id} style={{...css.card,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}><span style={{fontSize:24}}>{a.serviceIcon}</span><div><div style={{fontWeight:800,color:T.text}}>{a.serviceName}</div><div style={{fontSize:12,color:T.muted}}>{fmtDate(a.date)} às {a.time} • {a.professionalName}</div></div></div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}><StatusBadge status={a.status}/><span style={{fontWeight:800,color:T.accent}}>R${a.servicePrice}</span></div>
      </div>)}
    </>:<div style={{...css.card,textAlign:"center",padding:"48px 20px"}}><div style={{fontSize:48,marginBottom:12}}>🌸</div><div style={{color:T.muted,marginBottom:16}}>Nenhum agendamento futuro.</div><Btn variant="primary" onClick={()=>setTab("book")}>Agendar agora →</Btn></div>}
  </div>;
}

function ClientBook({user,appointments,services,professionals,onBook}){
  const [step,setStep]=useState(0);
  const [sel,setSel]=useState({serviceId:null,professionalId:null,date:todayStr(),time:null,notes:""});
  const TIME_SLOTS=["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"];
  const active=services.filter(s=>s.active);
  const svc=active.find(s=>s.id===sel.serviceId);
  const prof=professionals.find(p=>p.id===sel.professionalId);
  const busy=sel.professionalId&&sel.date?TIME_SLOTS.filter(t=>appointments.some(a=>a.date===sel.date&&a.professionalId===sel.professionalId&&a.time===t&&a.status!=="cancelled")):[];
  const canNext=[!!sel.serviceId,!!sel.professionalId,!!(sel.date&&sel.time),true];
  const steps=["Serviço","Profissional","Data & Hora","Confirmar"];
  return <div style={{animation:"fadeIn .4s ease"}}>
    <h2 style={{fontSize:22,fontWeight:900,color:T.text,marginBottom:24}}>📅 Novo Agendamento</h2>
    <div style={{display:"flex",gap:0,marginBottom:32}}>{steps.map((s,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",position:"relative"}}>{i>0&&<div style={{position:"absolute",left:"-50%",top:14,width:"100%",height:2,background:i<=step?T.accent:T.border,zIndex:0}}/>}<div style={{width:28,height:28,borderRadius:"50%",zIndex:1,background:i<=step?T.accent:T.border,color:i<=step?"#fff":T.muted,fontWeight:800,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>{i<step?"✓":i+1}</div><div style={{fontSize:10,color:i===step?T.accent:T.muted,fontWeight:700,marginTop:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{s}</div></div>)}</div>
    {step===0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>{active.map(s=><div key={s.id} onClick={()=>setSel(p=>({...p,serviceId:s.id}))} style={{...css.card,cursor:"pointer",borderColor:sel.serviceId===s.id?T.accent:T.border,borderWidth:sel.serviceId===s.id?2:1,background:sel.serviceId===s.id?"#fff8f5":T.surface,transition:"all .2s"}}><div style={{fontSize:30,marginBottom:8}}>{s.icon}</div><div style={{fontWeight:800,color:T.text,marginBottom:2}}>{s.name}</div><div style={{fontSize:12,color:T.muted,marginBottom:6}}>{s.duration} min</div><div style={{fontWeight:900,color:T.accent,fontSize:18}}>R${s.price}</div></div>)}</div>}
    {step===1&&<div style={{display:"flex",gap:14,flexWrap:"wrap"}}>{professionals.map(p=><div key={p.id} onClick={()=>setSel(pr=>({...pr,professionalId:p.id}))} style={{...css.card,flex:"1 1 180px",cursor:"pointer",borderColor:sel.professionalId===p.id?T.accent:T.border,borderWidth:sel.professionalId===p.id?2:1,background:sel.professionalId===p.id?"#fff8f5":T.surface,textAlign:"center",transition:"all .2s"}}><div style={{width:52,height:52,borderRadius:"50%",margin:"0 auto 10px",background:p.color+"33",border:`3px solid ${p.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:20,color:p.color}}>{p.name[0]}</div><div style={{fontWeight:800,color:T.text}}>{p.name}</div><div style={{fontSize:12,color:T.muted,marginTop:4}}>{p.specialty}</div></div>)}</div>}
    {step===2&&<div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
      <div style={{flex:"0 0 260px"}}><h3 style={{fontWeight:800,color:T.text,marginBottom:12}}>Escolha a data</h3><MiniCalendar selected={sel.date} onSelect={d=>setSel(p=>({...p,date:d,time:null}))} appointments={appointments}/></div>
      <div style={{flex:1,minWidth:240}}><h3 style={{fontWeight:800,color:T.text,marginBottom:12}}>Escolha o horário</h3><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>{["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"].map(t=>{const b=busy.includes(t),isSel=sel.time===t;return<button key={t} disabled={b} onClick={()=>setSel(p=>({...p,time:t}))} style={{padding:"9px 6px",borderRadius:8,fontWeight:700,fontSize:12,fontFamily:"inherit",cursor:b?"not-allowed":"pointer",background:isSel?T.accent:b?"#f0e8e4":T.surface,color:isSel?"#fff":b?"#d4b5aa":T.text,border:isSel?`2px solid ${T.accent}`:`1px solid ${T.border}`,textDecoration:b?"line-through":"none"}}>{t}</button>;})}
      </div></div>
    </div>}
    {step===3&&<div><h3 style={{fontWeight:800,color:T.text,marginBottom:16}}>Confirmar</h3><div style={{...css.card,marginBottom:16}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{[["Serviço",`${svc?.icon} ${svc?.name}`],["Profissional",prof?.name],["Data",fmtDate(sel.date)],["Horário",sel.time],["Duração",`${svc?.duration} min`],["Valor",`R$${svc?.price}`]].map(([l,v])=><div key={l}><div style={css.label}>{l}</div><div style={{fontWeight:700,color:T.text}}>{v}</div></div>)}</div></div><Field label="Observações"><textarea value={sel.notes} onChange={e=>setSel(p=>({...p,notes:e.target.value}))} rows={2} style={{...css.input,resize:"vertical"}}/></Field></div>}
    <div style={{display:"flex",justifyContent:"space-between",marginTop:28}}>
      <Btn variant="ghost" onClick={()=>setStep(s=>s-1)} style={{visibility:step===0?"hidden":"visible"}}>← Voltar</Btn>
      {step<3?<Btn variant="primary" disabled={!canNext[step]} onClick={()=>setStep(s=>s+1)}>Próximo →</Btn>
        :<Btn variant="primary" onClick={()=>onBook({serviceId:sel.serviceId,professionalId:sel.professionalId,date:sel.date,time:sel.time,notes:sel.notes})}>✅ Confirmar</Btn>}
    </div>
  </div>;
}

function ClientMyAppts({appts,services,onCancel,onConsent}){
  const groups=useMemo(()=>{const g={upcoming:[],past:[],consent:[]};appts.forEach(a=>{if(a.consentRequest?.status==="pending")g.consent.push(a);else if(a.date>=todayStr())g.upcoming.push(a);else g.past.push(a);});return g;},[appts]);
  const Row=({a,showActions})=><div style={{...css.card,marginBottom:10,borderLeft:`4px solid ${a.professionalColor||T.accent}`}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12}}>
      <div style={{display:"flex",gap:12}}><span style={{fontSize:24}}>{a.serviceIcon}</span><div><div style={{fontWeight:800,color:T.text}}>{a.serviceName}</div><div style={{fontSize:12,color:T.muted}}>{fmtDate(a.date)} às {a.time} • {a.professionalName}</div><div style={{fontWeight:700,color:T.accent,fontSize:13,marginTop:2}}>R${a.servicePrice}</div>{a.notes&&<div style={{fontSize:11,color:T.muted,fontStyle:"italic",marginTop:4}}>📝 {a.notes}</div>}</div></div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}><StatusBadge status={a.status}/>{showActions&&a.status!=="cancelled"&&a.date>=todayStr()&&<Btn variant="ghost" size="sm" onClick={()=>onCancel(a.id)}>Cancelar</Btn>}</div>
    </div>
    {a.consentRequest?.status==="pending"&&<div style={{marginTop:14,background:"#fff8e8",border:`1.5px solid ${T.gold}`,borderRadius:10,padding:"12px 16px"}}>
      <div style={{fontWeight:800,color:T.gold,marginBottom:4}}>⚠️ Solicitação do salão</div>
      <div style={{fontSize:13,color:T.text,marginBottom:10}}><strong>{a.consentRequest.type==="cancel"?"Cancelamento":"Remarcação"}</strong>{a.consentRequest.type==="reschedule"&&<> para <strong>{fmtDate(a.consentRequest.newDate)}</strong> às <strong>{a.consentRequest.newTime}</strong></>}{a.consentRequest.reason&&<div style={{color:T.muted,fontSize:12,marginTop:4}}>Motivo: {a.consentRequest.reason}</div>}</div>
      <div style={{display:"flex",gap:8}}><Btn variant="green" size="sm" onClick={()=>onConsent(a.id,true)}>✓ Aceitar</Btn><Btn variant="danger" size="sm" onClick={()=>onConsent(a.id,false)}>✕ Recusar</Btn></div>
    </div>}
  </div>;
  return <div style={{animation:"fadeIn .4s ease"}}>
    <h2 style={{fontSize:22,fontWeight:900,color:T.text,marginBottom:24}}>📋 Meus Agendamentos</h2>
    {groups.consent.length>0&&<div style={{marginBottom:28}}><h3 style={{fontWeight:800,color:T.gold,fontSize:15,marginBottom:12}}>⚠️ Solicitações ({groups.consent.length})</h3>{groups.consent.map(a=><Row key={a.id} a={a} showActions={false}/>)}</div>}
    {groups.upcoming.length>0&&<div style={{marginBottom:28}}><h3 style={{fontWeight:800,color:T.text,fontSize:15,marginBottom:12}}>📅 Próximos</h3>{groups.upcoming.map(a=><Row key={a.id} a={a} showActions={true}/>)}</div>}
    {groups.past.length>0&&<div><h3 style={{fontWeight:800,color:T.muted,fontSize:15,marginBottom:12}}>🕐 Histórico</h3>{groups.past.map(a=><Row key={a.id} a={a} showActions={false}/>)}</div>}
    {appts.length===0&&<div style={{...css.card,textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:48,marginBottom:12}}>🌸</div><div style={{color:T.muted}}>Nenhum agendamento.</div></div>}
  </div>;
}

// ══════════════════════════════════════════════════════════════
//  OWNER PORTAL
// ══════════════════════════════════════════════════════════════

function OwnerPortal({ user, token, onLogout }) {
  const [tab,setTab]          = useState("dash");
  const [appointments,setAppts]= useState([]);
  const [clients,setClients]  = useState([]);
  const [services,setServices]= useState([]);
  const [professionals,setProfs]= useState([]);
  const [loading,setLoading]  = useState(true);
  const {toasts,show}         = useToast();

  const load = useCallback(async () => {
    try {
      const [appts,cls,svcs,profs] = await Promise.all([
        api("/appointments",{token}),
        api("/clients",{token}),
        api("/services",{token}),
        api("/professionals",{token}),
      ]);
      setAppts(appts);setClients(cls);setServices(svcs);setProfs(profs);
    } catch(e){show(e.message,"error");}
    finally{setLoading(false);}
  },[token]);

  useEffect(()=>{load();},[load]);

  const handleSave = async (appt) => {
    try {
      if (appt.id) await api(`/appointments/${appt.id}`,{method:"PATCH",token,body:appt});
      else await api("/appointments",{method:"POST",token,body:appt});
      show("Salvo!"); load();
    } catch(e){show(e.message,"error");}
  };

  const handleConsent = async (id, req) => {
    try { await api(`/appointments/${id}/consent-request`,{method:"POST",token,body:req}); show("Solicitação enviada!","warn"); load(); }
    catch(e){show(e.message,"error");}
  };

  const handleUpdateService = async (svc) => {
    try { await api(`/services/${svc.id}`,{method:"PATCH",token,body:svc}); show("Serviço atualizado!"); load(); }
    catch(e){show(e.message,"error");}
  };

  const handleAddClient = async (c) => {
    try { await api("/clients",{method:"POST",token,body:c}); show("Cliente cadastrado!"); load(); }
    catch(e){show(e.message,"error");}
  };

  if(loading)return<Spinner/>;

  return <div style={{minHeight:"100vh",background:"#f5f0ec",fontFamily:"'Georgia',serif"}}>
    <Toasts items={toasts}/>
    <header style={{background:T.text,borderBottom:`3px solid ${T.accent}`,padding:"0 28px",display:"flex",alignItems:"center",justifyContent:"space-between",height:62,position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:22}}>💅</span><div><div style={{fontWeight:900,fontSize:16,color:"#fff"}}>Belle Studio</div><div style={{fontSize:10,color:T.accent,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Painel da Proprietária</div></div></div>
      <nav style={{display:"flex",gap:4}}>{[["dash","📊 Dashboard"],["agenda","📅 Agenda"],["clients","👩 Clientes"],["services","💎 Serviços"]].map(([key,label])=><button key={key} onClick={()=>setTab(key)} style={{background:tab===key?T.accent:"transparent",border:tab===key?"none":`1px solid #5a3a2a`,borderRadius:8,color:tab===key?"#fff":"#c9a090",padding:"7px 14px",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",transition:"all .2s"}}>{label}</button>)}</nav>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <NotificationBell token={token}/>
        <Btn variant="ghost" size="sm" onClick={onLogout} style={{color:"#c9a090",borderColor:"#5a3a2a"}}>Sair</Btn>
      </div>
    </header>
    <main style={{maxWidth:1200,margin:"0 auto",padding:"28px 20px"}}>
      {tab==="dash"&&<OwnerDash appointments={appointments} clients={clients} services={services} token={token} show={show}/>}
      {tab==="agenda"&&<OwnerAgenda appointments={appointments} clients={clients} services={services} professionals={professionals} token={token} onSave={handleSave} onConsent={handleConsent} reload={load} show={show}/>}
      {tab==="clients"&&<OwnerClients clients={clients} appointments={appointments} services={services} onAdd={handleAddClient}/>}
      {tab==="services"&&<OwnerServices services={services} onUpdate={handleUpdateService}/>}
    </main>
  </div>;
}

function OwnerDash({appointments,clients,services,token,show}){
  const todayA=appointments.filter(a=>a.date===todayStr()&&a.status!=="cancelled");
  const rev=todayA.reduce((s,a)=>s+(a.servicePrice||0),0);
  const pending=appointments.filter(a=>a.status==="pending");
  const monthA=appointments.filter(a=>a.date.slice(0,7)===todayStr().slice(0,7)&&a.status!=="cancelled");
  const monthRev=monthA.reduce((s,a)=>s+(a.servicePrice||0),0);
  const stats=[{l:"Agend. Hoje",v:todayA.length,ic:"📅",c:T.accent},{l:"Pendentes",v:pending.length,ic:"⏳",c:T.gold},{l:"Fatur. Hoje",v:`R$${rev}`,ic:"💰",c:T.green},{l:"Fatur. Mês",v:`R$${monthRev}`,ic:"📈",c:T.blue},{l:"Clientes",v:clients.length,ic:"👩",c:"#8c5a9c"},{l:"Agend. Mês",v:monthA.length,ic:"📊",c:T.accent2}];
  const svcCount=services.map(s=>({...s,count:appointments.filter(a=>a.serviceId===s.id&&a.status!=="cancelled").length})).sort((a,b)=>b.count-a.count);
  return <div style={{animation:"fadeIn .4s ease"}}>
    <h2 style={{fontSize:24,fontWeight:900,color:T.text,marginBottom:24}}>📊 Dashboard</h2>
    <RemindersPanel appointments={todayA} token={token} onToast={show}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:28}}>{stats.map((s,i)=><div key={i} style={{...css.card,borderTop:`4px solid ${s.c}`}}><div style={{fontSize:24,marginBottom:4}}>{s.ic}</div><div style={{fontSize:26,fontWeight:900,color:s.c}}>{s.v}</div><div style={{fontSize:11,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{s.l}</div></div>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      <div style={css.card}><h3 style={{margin:"0 0 16px",fontWeight:800,color:T.text,fontSize:15}}>🏆 Top Serviços</h3>{svcCount.map((s,i)=><div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<svcCount.length-1?`1px solid ${T.border}`:"none"}}><div style={{display:"flex",gap:8}}><span>{s.icon}</span><span style={{fontSize:13,fontWeight:700,color:T.text}}>{s.name}</span></div><div style={{display:"flex",gap:8}}><span style={{fontSize:12,color:T.muted}}>{s.count}x</span><span style={{fontWeight:800,color:T.accent}}>R${s.price}</span></div></div>)}</div>
      <div style={css.card}><h3 style={{margin:"0 0 16px",fontWeight:800,color:T.text,fontSize:15}}>👩 Top Clientes</h3>{clients.slice(0,6).map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}><div style={{display:"flex",gap:8}}><div style={{width:28,height:28,borderRadius:"50%",background:T.accent+"22",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,color:T.accent}}>{c.name[0]}</div><span style={{fontSize:13,fontWeight:700,color:T.text}}>{c.name}</span></div><span style={{fontSize:12,color:T.muted}}>{c.visits}x</span></div>)}</div>
    </div>
  </div>;
}

function OwnerAgenda({appointments,clients,services,professionals,token,onSave,onConsent,reload,show}){
  const TIME_SLOTS=["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"];
  const [selDate,setSelDate]=useState(todayStr());
  const [editModal,setEditModal]=useState(null);
  const [consentModal,setConsentModal]=useState(null);
  const [consentForm,setConsentForm]=useState({type:"cancel",newDate:todayStr(),newTime:"",reason:""});
  const [newModal,setNewModal]=useState(false);
  const dayAppts=appointments.filter(a=>a.date===selDate).sort((a,b)=>a.time.localeCompare(b.time));

  const sendConsent=async()=>{
    if(!consentForm.reason)return alert("Informe o motivo.");
    if(consentForm.type==="reschedule"&&!consentForm.newTime)return alert("Informe o horário.");
    await onConsent(consentModal.id,{...consentForm,status:"pending"});
    setConsentModal(null);
  };

  const Card=({a})=>{
    const hasConsent=a.consentRequest?.status==="pending";
    return <div style={{...css.card,borderLeft:`5px solid ${a.professionalColor||T.accent}`,marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12}}>
        <div style={{display:"flex",gap:12}}><div style={{textAlign:"center"}}><div style={{fontSize:22}}>{a.serviceIcon}</div><div style={{fontSize:12,fontWeight:800,color:T.accent}}>{a.time}</div></div><div><div style={{fontWeight:900,color:T.text,fontSize:15}}>{a.clientName}</div><div style={{fontSize:12,color:T.muted}}>{a.clientPhone} • {a.clientEmail}</div><div style={{fontSize:12,color:T.text,marginTop:2}}>{a.serviceName} • {a.professionalName}</div><div style={{fontSize:13,fontWeight:800,color:T.green,marginTop:2}}>R${a.servicePrice}</div>{a.notes&&<div style={{fontSize:11,color:T.muted,fontStyle:"italic",marginTop:4}}>📝 {a.notes}</div>}</div></div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
          <StatusBadge status={hasConsent?"consent_pending":a.status}/>
          {!hasConsent&&<div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <Btn size="sm" variant="outline" onClick={()=>setEditModal(a)}>✏️</Btn>
            {a.status!=="cancelled"&&<Btn size="sm" variant="ghost" onClick={()=>{setConsentModal(a);setConsentForm({type:"cancel",newDate:a.date,newTime:a.time,reason:""});}}>🔔</Btn>}
            {a.status==="pending"&&<Btn size="sm" variant="green" onClick={()=>onSave({id:a.id,status:"confirmed"})}>✓</Btn>}
            {a.status==="confirmed"&&<Btn size="sm" variant="gold" onClick={()=>onSave({id:a.id,status:"done"})}>✓ Concluído</Btn>}
          </div>}
          {hasConsent&&<div style={{fontSize:11,color:T.gold,textAlign:"right"}}>⏳ Aguard. cliente</div>}
        </div>
      </div>
    </div>;
  };

  return <div style={{animation:"fadeIn .4s ease",display:"flex",gap:24,flexWrap:"wrap"}}>
    <div style={{width:260,flexShrink:0}}>
      <MiniCalendar selected={selDate} onSelect={setSelDate} appointments={appointments}/>
      <div style={{marginTop:14}}><Btn variant="primary" style={{width:"100%",justifyContent:"center"}} onClick={()=>setNewModal(true)}>＋ Novo</Btn></div>
      {selDate===todayStr()&&<div style={{marginTop:14}}><RemindersPanel appointments={appointments.filter(a=>a.date===todayStr()&&a.status!=="cancelled")} token={token} onToast={show}/></div>}
    </div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:900,color:T.text}}>{fmtDate(selDate)}{selDate===todayStr()&&<span style={{marginLeft:8,fontSize:11,background:T.accent,color:"#fff",padding:"2px 10px",borderRadius:20}}>Hoje</span>}</h2>
        <span style={{color:T.muted,fontSize:13}}>{dayAppts.length} agendamento{dayAppts.length!==1?"s":""}</span>
      </div>
      {dayAppts.length===0?<div style={{...css.card,textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:48,marginBottom:12}}>📅</div><div style={{color:T.muted}}>Sem agendamentos.</div></div>:dayAppts.map(a=><Card key={a.id} a={a}/>)}
    </div>
    <Modal open={!!editModal} onClose={()=>setEditModal(null)} title="✏️ Editar Agendamento">
      {editModal&&<OwnerEditForm appt={editModal} clients={clients} services={services} professionals={professionals} appointments={appointments} onSave={a=>{onSave(a);setEditModal(null);}} onClose={()=>setEditModal(null)}/>}
    </Modal>
    <Modal open={!!consentModal} onClose={()=>setConsentModal(null)} title="🔔 Solicitar Consentimento">
      {consentModal&&<div>
        <p style={{color:T.muted,fontSize:13,marginBottom:16}}>Solicitação para <strong>{consentModal.clientName}</strong>.</p>
        <Sel label="Tipo" value={consentForm.type} onChange={e=>setConsentForm(f=>({...f,type:e.target.value}))}><option value="cancel">Cancelamento</option><option value="reschedule">Remarcação</option></Sel>
        {consentForm.type==="reschedule"&&<><Inp label="Nova data" type="date" value={consentForm.newDate} onChange={e=>setConsentForm(f=>({...f,newDate:e.target.value}))}/><Sel label="Novo horário" value={consentForm.newTime} onChange={e=>setConsentForm(f=>({...f,newTime:e.target.value}))}><option value="">Selecione...</option>{TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}</Sel></>}
        <Field label="Motivo *"><textarea value={consentForm.reason} onChange={e=>setConsentForm(f=>({...f,reason:e.target.value}))} rows={3} style={{...css.input,resize:"vertical"}}/></Field>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={()=>setConsentModal(null)}>Cancelar</Btn><Btn variant="gold" onClick={sendConsent}>📨 Enviar</Btn></div>
      </div>}
    </Modal>
    <Modal open={newModal} onClose={()=>setNewModal(false)} title="＋ Novo Agendamento">
      {newModal&&<OwnerNewApptForm clients={clients} services={services} professionals={professionals} appointments={appointments} defaultDate={selDate} onSave={a=>{onSave(a);setNewModal(false);}} onClose={()=>setNewModal(false)}/>}
    </Modal>
  </div>;
}

function OwnerEditForm({appt,clients,services,professionals,appointments,onSave,onClose}){
  const TIME_SLOTS=["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"];
  const [form,setForm]=useState({id:appt.id,clientId:appt.clientId,serviceId:appt.serviceId,professionalId:appt.professionalId,date:appt.date,time:appt.time,status:appt.status,notes:appt.notes||""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const busy=TIME_SLOTS.filter(t=>appointments.some(a=>a.date===form.date&&a.professionalId===form.professionalId&&a.time===t&&a.status!=="cancelled"&&a.id!==form.id));
  return <div>
    <Sel label="Cliente" value={form.clientId} onChange={e=>set("clientId",e.target.value)}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Sel>
    <Sel label="Serviço" value={form.serviceId} onChange={e=>set("serviceId",e.target.value)}>{services.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}</Sel>
    <Sel label="Profissional" value={form.professionalId} onChange={e=>set("professionalId",e.target.value)}>{professionals.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Sel>
    <Inp label="Data" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/>
    <Field label="Horário"><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>{TIME_SLOTS.map(t=>{const b=busy.includes(t),s=form.time===t;return<button key={t} disabled={b} onClick={()=>set("time",t)} style={{padding:"7px 4px",borderRadius:7,fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:b?"not-allowed":"pointer",background:s?T.accent:b?"#f0e4de":T.bg,color:s?"#fff":b?"#c9a090":T.text,border:s?"none":`1px solid ${T.border}`,textDecoration:b?"line-through":"none"}}>{t}</button>;})}</div></Field>
    <Sel label="Status" value={form.status} onChange={e=>set("status",e.target.value)}><option value="pending">Pendente</option><option value="confirmed">Confirmado</option><option value="done">Concluído</option><option value="cancelled">Cancelado</option></Sel>
    <Field label="Observações"><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...css.input,resize:"vertical"}}/></Field>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn variant="primary" onClick={()=>onSave(form)}>💾 Salvar</Btn></div>
  </div>;
}

function OwnerNewApptForm({clients,services,professionals,appointments,defaultDate,onSave,onClose}){
  const TIME_SLOTS=["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"];
  const [form,setForm]=useState({clientId:clients[0]?.id||"",serviceId:services[0]?.id||"",professionalId:professionals[0]?.id||"",date:defaultDate,time:"",status:"confirmed",notes:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const busy=TIME_SLOTS.filter(t=>appointments.some(a=>a.date===form.date&&a.professionalId===form.professionalId&&a.time===t&&a.status!=="cancelled"));
  return <div>
    <Sel label="Cliente *" value={form.clientId} onChange={e=>set("clientId",e.target.value)}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Sel>
    <Sel label="Serviço *" value={form.serviceId} onChange={e=>set("serviceId",e.target.value)}>{services.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.icon} {s.name} — R${s.price}</option>)}</Sel>
    <Sel label="Profissional *" value={form.professionalId} onChange={e=>set("professionalId",e.target.value)}>{professionals.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Sel>
    <Inp label="Data *" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/>
    <Field label="Horário *"><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>{TIME_SLOTS.map(t=>{const b=busy.includes(t),s=form.time===t;return<button key={t} disabled={b} onClick={()=>set("time",t)} style={{padding:"7px 4px",borderRadius:7,fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:b?"not-allowed":"pointer",background:s?T.accent:b?"#f0e4de":T.bg,color:s?"#fff":b?"#c9a090":T.text,border:s?"none":`1px solid ${T.border}`,textDecoration:b?"line-through":"none"}}>{t}</button>;})}</div></Field>
    <Field label="Observações"><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...css.input,resize:"vertical"}}/></Field>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn variant="primary" onClick={()=>{if(!form.clientId||!form.time)return alert("Preencha todos.");onSave({clientId:form.clientId,serviceId:form.serviceId,professionalId:form.professionalId,date:form.date,time:form.time,status:form.status,notes:form.notes});}}>💾 Agendar</Btn></div>
  </div>;
}

function OwnerClients({clients,appointments,services,onAdd}){
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({name:"",phone:"",email:"",password:""});
  const [errors,setErrors]=useState({});
  const [search,setSearch]=useState("");
  const filtered=clients.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.email.includes(search)||c.phone.includes(search));
  const handleAdd=()=>{const errs={};if(!form.name)errs.name="Obrigatório";if(!form.phone)errs.phone="Obrigatório";if(!form.email)errs.email="E-mail inválido";if(form.password.length<6)errs.password="Mínimo 6";setErrors(errs);if(Object.keys(errs).length)return;onAdd(form);setModal(false);setForm({name:"",phone:"",email:"",password:""});setErrors({});};
  return <div style={{animation:"fadeIn .4s ease"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><h2 style={{margin:0,fontSize:22,fontWeight:900,color:T.text}}>👩 Clientes ({clients.length})</h2><Btn variant="primary" onClick={()=>setModal(true)}>＋ Cadastrar</Btn></div>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar..." style={{...css.input,marginBottom:20,maxWidth:380}}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
      {filtered.map(c=><div key={c.id} style={css.card}><div style={{display:"flex",gap:12,marginBottom:12}}><div style={{width:44,height:44,borderRadius:"50%",background:T.accent+"22",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:17,color:T.accent,flexShrink:0}}>{c.name[0]}</div><div><div style={{fontWeight:800,color:T.text}}>{c.name}</div><div style={{fontSize:12,color:T.muted}}>{c.email}</div><div style={{fontSize:12,color:T.muted}}>{c.phone}</div></div></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><span style={{fontSize:12,background:T.accent+"15",color:T.accent,padding:"3px 10px",borderRadius:20,fontWeight:700}}>{c.visits} visita{c.visits!==1?"s":""}</span><span style={{fontSize:12,background:T.green+"15",color:T.green,padding:"3px 10px",borderRadius:20,fontWeight:700}}>R${c.spent}</span></div>{c.lastVisit&&<div style={{fontSize:11,color:T.muted,marginTop:8}}>Último: {fmtDate(c.lastVisit)}</div>}</div>)}
    </div>
    <Modal open={modal} onClose={()=>setModal(false)} title="＋ Cadastrar Nova Cliente">
      <Inp label="Nome *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} error={errors.name}/>
      <Inp label="Celular *" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="11999990000" error={errors.phone}/>
      <Inp label="E-mail *" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} error={errors.email}/>
      <Inp label="Senha *" type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Mínimo 6 caracteres" error={errors.password}/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={()=>setModal(false)}>Cancelar</Btn><Btn variant="primary" onClick={handleAdd}>💾 Cadastrar</Btn></div>
    </Modal>
  </div>;
}

function OwnerServices({services,onUpdate}){
  const [editing,setEditing]=useState(null);const [form,setForm]=useState({});
  return <div style={{animation:"fadeIn .4s ease"}}>
    <h2 style={{fontSize:22,fontWeight:900,color:T.text,marginBottom:20}}>💎 Serviços</h2>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
      {services.map(s=><div key={s.id} style={{...css.card,opacity:s.active?1:0.55}}>
        {editing===s.id?<div><Inp label="Nome" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><Inp label="Preço (R$)" type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:Number(e.target.value)}))}/><Inp label="Duração (min)" type="number" value={form.duration} onChange={e=>setForm(f=>({...f,duration:Number(e.target.value)}))}/></div><div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}><input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))}/><label style={{fontSize:13,color:T.text,fontWeight:700}}>Ativo</label></div><div style={{display:"flex",gap:8}}><Btn variant="ghost" size="sm" onClick={()=>setEditing(null)}>Cancelar</Btn><Btn variant="primary" size="sm" onClick={()=>{onUpdate(form);setEditing(null);}}>💾 Salvar</Btn></div></div>
        :<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontSize:28,marginBottom:6}}>{s.icon}</div><div style={{fontWeight:800,color:T.text,marginBottom:2}}>{s.name}</div><div style={{fontSize:12,color:T.muted,marginBottom:6}}>{s.duration} min</div><div style={{fontWeight:900,color:T.accent,fontSize:20}}>R${s.price}</div></div><div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}><span style={{fontSize:11,background:s.active?T.green+"22":T.muted+"22",color:s.active?T.green:T.muted,padding:"2px 10px",borderRadius:20,fontWeight:700}}>{s.active?"Ativo":"Inativo"}</span><Btn size="sm" variant="outline" onClick={()=>{setEditing(s.id);setForm({...s});}}>✏️ Editar</Btn></div></div>}
      </div>)}
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════════
//  ROOT APP
// ══════════════════════════════════════════════════════════════

export default function App() {
  const [token,setToken] = useState(() => localStorage.getItem("belle_token"));
  const [user,setUser]   = useState(() => { try { const t=localStorage.getItem("belle_token"); if(!t)return null; const p=JSON.parse(atob(t.split(".")[1])); return p; } catch{ return null; } });

  const handleLogin = (token, user) => {
    localStorage.setItem("belle_token", token);
    setToken(token); setUser(user);
  };
  const handleLogout = () => {
    localStorage.removeItem("belle_token");
    setToken(null); setUser(null);
  };

  if (!token || !user) return <AuthPage onLogin={handleLogin}/>;
  if (user.role === "owner") return <OwnerPortal user={user} token={token} onLogout={handleLogout}/>;
  return <ClientPortal user={user} token={token} onLogout={handleLogout}/>;
}
