import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import reference from '../../assets/brand/registrador-reference.png';
import regular from '../../assets/fonts/RobotoCondensed-Regular.ttf';
import bold from '../../assets/fonts/RobotoCondensed-Bold.ttf';
import Icon from './IconoRegistrador.web';
import './PanelRegistrador.css';
import { API_BASE_URL, fetchApi } from '../../configuracion';

const referenceUrl = Image.resolveAssetSource ? Image.resolveAssetSource(reference)?.uri : reference;
const assetUrl = typeof reference === 'string' ? reference : reference?.uri || referenceUrl;
const fontUrl = (font) => typeof font === 'string' ? font : font?.uri || Image.resolveAssetSource?.(font)?.uri;
export function ReferenceCrop({ x, y, w, h, className = '', label }) {
  return <span className={`reg-crop ${className}`} style={{ aspectRatio: `${w}/${h}` }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <img src={assetUrl} alt="" draggable="false" style={{ width: `${1536 / w * 100}%`, left: `${-x / w * 100}%`, top: `${-y / h * 100}%` }}/>
  </span>;
}

const menu = [
  ['home', 'Inicio', 'dashboard'], ['coop', 'Cooperativas', 'cooperatives'],
  ['truck', 'Vehículos', 'vehicles'],
  ['people', 'Usuarios', 'users'],

  ['file', 'Reportes', 'registryReports'], ['gear', 'Configuración', 'settings'],
];
const metricCards = [
  ['people', 'cooperativas', 'Cooperativas registradas'],
  ['farmer', 'caficultores', 'Caficultores registrados'],
  ['truck', 'vehiculos', 'Vehículos registrados'],
  ['driver', 'conductores', 'Conductores registrados'],
];
const quickActions = [
  ['people', 'Registrar Cooperativa', 'Crea una nueva cooperativa', 'cooperatives'],
  ['people', 'Crear usuario', 'Caficultor, conductor y otros roles', 'users'],
  ['truck', 'Registrar Vehículo', 'Registra un vehículo de transporte', 'vehicles'],

];
const Header = ({ icon, title, action, onAction }) => <div className="reg-card-heading"><h2><Icon name={icon}/>{title}</h2>{action && <button onClick={onAction} className="reg-text-button">{action}</button>}</div>;
const Badge = ({ children, tone = 'green' }) => <span className={`reg-badge ${tone}`}><span>✓</span>{children}</span>;

export default function PanelRegistrador({ token, user, summary, loading, error, connectionStatus, screen = 'dashboard', go, onLogout, onRefresh, children, notice }) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 850);
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [section, setSection] = useState(null);
  useEffect(() => { setSection(null); setProfileOpen(false); }, [screen]);
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') { setProfileOpen(false); setNotificationsOpen(false); setSection(null); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);
  const name = [user?.nombre || user?.nombre_usuario || 'Registrador', user?.apellido].filter(Boolean).join(' ');
  const navigate = (target) => {
    if (['registryReports', 'settings'].includes(target)) { setSection(target); return; }
    setSection(null); go(target); if (window.innerWidth < 850) setCollapsed(true);
  };
  const active = section || screen;
  const totals = summary?.totals || {};
  const coops = summary?.cooperatives || [];

  const activity = summary?.activity || [];
  const online = connectionStatus === 'online';
  const count = (key) => loading && !summary ? '—' : totals[key] ?? '—';
  const exportRegistry = async (format) => {
    if (exporting) return;
    setExporting(format); setExportError('');
    try {
      const response = await fetchApi(`${API_BASE_URL}/reportes/registros/exportar?formato=${format}`, { headers: { Authorization: `Bearer ${token}` }, timeoutMs: 30000, allowNonJson: true });
      if (!response.ok) throw Error('No se pudo descargar el resumen. Intenta nuevamente.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = `CoffeeFly_registros.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    } catch (reason) { setExportError(reason.message); }
    finally { setExporting(''); }
  };
  return <div className={`registrar-app ${collapsed ? 'reg-collapsed' : ''}`}>
    <style>{`@font-face{font-family:Registrar;src:url('${fontUrl(regular)}');font-weight:400;font-display:swap}@font-face{font-family:Registrar;src:url('${fontUrl(bold)}');font-weight:600 900;font-display:swap}`}</style>
    <aside className="reg-sidebar" aria-label="Navegación del registrador">
      <button className="reg-brand" onClick={() => navigate('dashboard')} aria-label="Coffee Fly, inicio"><ReferenceCrop x={55} y={5} w={133} h={89} label="Coffee Fly · Tu café viaja"/></button>
      <div className="reg-sidebar-user"><ReferenceCrop x={25} y={120} w={64} h={64} className="reg-avatar"/><div><strong>{name}</strong><small>Registrador</small><span className="reg-online"><i className={online ? '' : 'offline'}/>{online ? 'En línea' : 'Sin conexión'}</span></div></div>
      <nav>{menu.map(([icon, label, target]) => <button key={target} className={active === target ? 'active' : ''} aria-current={active === target ? 'page' : undefined} onClick={() => navigate(target)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
      <div className="reg-sidebar-art"><ReferenceCrop x={0} y={731} w={241} h={293}/></div>
    </aside>
    <div className="reg-workspace">
      <header className="reg-topbar"><button className="reg-icon-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Mostrar menú' : 'Ocultar menú'} aria-expanded={!collapsed}><Icon name="menu" size={26}/></button><div className="reg-topbar-right">
        <div className="reg-popover-anchor"><button className="reg-notifications reg-icon-button" aria-label="Notificaciones" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }}><Icon name="bell" size={28}/>{error || notice ? <span className="reg-counter">1</span> : null}</button>{notificationsOpen && <div className="reg-popover"><strong>Notificaciones</strong><p>{error || notice || 'No tienes notificaciones pendientes.'}</p></div>}</div>
        <div className="reg-popover-anchor"><button className="reg-profile" aria-expanded={profileOpen} onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}><ReferenceCrop x={1293} y={13} w={53} h={53} className="reg-avatar"/><span><strong>{name}</strong><small>Registrador</small></span><Icon name="chevron" size={16}/></button>{profileOpen && <div className="reg-popover"><strong>{name}</strong><p>{user?.correo_usuario || 'Cuenta de registrador'}</p><button onClick={() => { setSection('settings'); setProfileOpen(false); }}>Configuración de cuenta</button><button onClick={onLogout}>Cerrar sesión</button></div>}</div>
      </div></header>
      <main className="reg-main">
        {error && <div className="reg-alert" role="alert">{error}<button onClick={onRefresh}>Reintentar</button></div>}
        {screen === 'dashboard' ? <>
          <section className="reg-hero" aria-label="Construyendo la cadena del café. Registra, organiza y conecta a todos los actores del transporte cafetero."><ReferenceCrop x={263} y={89} w={1254} h={187}/><h1 className="reg-sr-only">Construyendo la cadena del café</h1></section>
          <section className="reg-metrics" aria-label="Resumen de registros">{metricCards.map(([icon, key, label], index) => <article className="reg-metric" key={key}><div className={`reg-disc disc-${index}`}><Icon name={icon} size={39}/></div><div><strong className="reg-metric-value">{count(key)}</strong><p>{label}</p></div></article>)}</section>
          <div className="reg-dashboard-grid">
            <section className="reg-card reg-actions"><Header icon="clipboard" title="Acciones rápidas"/><div className="reg-action-grid">{quickActions.map(([icon, title, description, target], index) => <button key={target} className={`reg-quick quick-${index}`} onClick={() => navigate(target)}><Icon name={icon} size={48}/><strong>{title}</strong><span>{description}</span></button>)}</div></section>
            <section className="reg-card reg-coops"><Header icon="people" title="Cooperativas recientes" action="Ver todas" onAction={() => navigate('cooperatives')}/><div className="reg-table-scroll"><table><thead><tr><th>Nombre</th><th>NIT</th><th>Caficultores</th><th>Ubicación</th><th>Estado</th></tr></thead><tbody>{coops.slice(0, 5).map((coop, index) => <tr key={coop.id_cooperativa}><td><span className={`reg-coop-logo coop-logo-${index}`}><Icon name="leaf" size={18}/></span>{coop.nombre}</td><td>{coop.nit || '—'}</td><td>{coop.caficultores ?? '—'}</td><td>{coop.ubicacion_texto || [coop.ubicacion?.ciudad, coop.ubicacion?.departamento].filter(Boolean).join(', ') || 'Sin ubicación'}</td><td><Badge>{coop.estado || 'Registrada'}</Badge></td></tr>)}{!coops.length && <tr><td colSpan={5} className="reg-empty">{loading ? 'Cargando cooperativas…' : 'Aún no hay cooperativas registradas.'}</td></tr>}</tbody></table></div></section>
            <section className="reg-card reg-activity"><Header icon="clock" title="Actividad reciente" action="Ver todas" onAction={() => setSection('activity')}/><div className="reg-activity-list">{activity.slice(0, 5).map((item, index) => <div className="reg-activity-item" key={item.id || index}><span className={`reg-disc disc-${index % 4}`}><Icon name={item.icon} size={24}/></span><div><strong>{item.title}</strong><span>{item.detail}</span><small>{item.time || 'Registro disponible'}</small></div></div>)}{!activity.length && <p className="reg-empty">Los registros aparecerán aquí.</p>}</div></section>
          </div>
        </> : <section className="reg-module">{children}</section>}
        <footer className="reg-footer"><span><Icon name="leaf" size={27}/><strong>Coffee Fly</strong><i/>Tu café viaja</span><span>Conectando personas, cosechas y destinos.</span></footer>
      </main>
    </div>
    {section && <div className="reg-modal-backdrop" onClick={() => setSection(null)}><section className="reg-modal" role="dialog" aria-modal="true" aria-labelledby="reg-modal-title" onClick={(event) => event.stopPropagation()}><button autoFocus className="reg-modal-close" onClick={() => setSection(null)} aria-label="Cerrar">×</button><h2 id="reg-modal-title">{menu.find(([, , key]) => key === section)?.[1] || 'Actividad reciente'}</h2>
      {section === 'registryReports' && <><p>Descarga el resumen de registros actualmente disponibles en tu panel.</p><p>Incluye cooperativas, vehículos y usuarios por rol. Los totales corresponden al momento de la descarga.</p>{exportError && <p role="alert">{exportError}</p>}<div className="reg-export-actions">{[["pdf", "Descargar PDF"], ["excel", "Descargar Excel (.xlsx)"]].map(([format, label]) => <button key={format} className="reg-green-button" disabled={Boolean(exporting)} onClick={() => exportRegistry(format)}>{exporting === format ? "Preparando…" : label}</button>)}</div></>}
      {section === 'settings' && <><p><strong>{name}</strong><br/>{user?.correo_usuario}<br/>Rol: Registrador</p><p>Gestiona los datos y accesos desde Usuarios y Roles.</p><button className="reg-green-button" onClick={() => navigate('users')}>Gestionar cuentas</button><button className="reg-text-button" onClick={onRefresh}>Actualizar datos del panel</button><button className="reg-text-button" onClick={onLogout}>Cerrar sesión</button></>}
      {section === 'activity' && <><p>Últimos registros disponibles. No se muestran horas de creación porque el sistema no las registra para estas entidades.</p>{activity.map((item, index) => <p key={index}><strong>{item.title}</strong><br/>{item.detail}</p>)}</>}
    </section></div>}
  </div>;
}
