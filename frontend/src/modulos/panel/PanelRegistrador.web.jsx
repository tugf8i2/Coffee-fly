import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import reference from '../../assets/brand/registrador-reference.png';
import Icon from './IconoRegistrador.web';
import './PanelRegistrador.css';

const referenceUrl = Image.resolveAssetSource ? Image.resolveAssetSource(reference)?.uri : reference;
const assetUrl = typeof reference === 'string' ? reference : reference?.uri || referenceUrl;
export function ReferenceCrop({ x, y, w, h, className = '', label }) {
  return <span className={`reg-crop ${className}`} style={{ aspectRatio: `${w}/${h}` }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <img src={assetUrl} alt="" draggable="false" style={{ width: `${1536 / w * 100}%`, left: `${-x / w * 100}%`, top: `${-y / h * 100}%` }}/>
  </span>;
}

const menu = [
  ['home', 'Inicio', 'dashboard'], ['coop', 'Cooperativas', 'cooperatives'],
  ['people', 'Caficultores', 'registrarFarmers'], ['truck', 'Vehículos', 'vehicles'],
  ['user', 'Conductores', 'registrarDrivers'], ['people', 'Usuarios y Roles', 'users'],
  ['file', 'Solicitudes', 'requests'], ['pin', 'Rutas y Zonas', 'zones'],
  ['file', 'Reportes', 'registryReports'], ['gear', 'Configuración', 'settings'],
];
const metricCards = [
  ['people', 'cooperativas', 'Cooperativas registradas', 'Ver cooperativas', 'cooperatives'],
  ['farmer', 'caficultores', 'Caficultores registrados', 'Ver caficultores', 'registrarFarmers'],
  ['truck', 'vehiculos', 'Vehículos registrados', 'Ver vehículos', 'vehicles'],
  ['driver', 'conductores', 'Conductores registrados', 'Ver conductores', 'registrarDrivers'],
];
const quickActions = [
  ['people', 'Registrar Cooperativa', 'Crea una nueva cooperativa', 'cooperatives'],
  ['farmer', 'Registrar Caficultor', 'Añade un nuevo caficultor', 'registrarFarmers'],
  ['truck', 'Registrar Vehículo', 'Registra un vehículo de transporte', 'vehicles'],
  ['driver', 'Registrar Conductor', 'Añade un nuevo conductor', 'registrarDrivers'],
];
const roles = [['user', 'Registradores', 'registradores'], ['people', 'Coordinadores', 'coordinadores'], ['user', 'Conductores', 'conductores'], ['people', 'Caficultores', 'caficultores'], ['user', 'Administradores', 'administradores']];
const Header = ({ icon, title, action, onAction }) => <div className="reg-card-heading"><h2><Icon name={icon}/>{title}</h2>{action && <button onClick={onAction} className="reg-text-button">{action}</button>}</div>;
const Badge = ({ children, tone = 'green' }) => <span className={`reg-badge ${tone}`}><span>✓</span>{children}</span>;

export default function PanelRegistrador({ user, summary, loading, error, connectionStatus, screen = 'dashboard', go, onLogout, onRefresh, children, notice }) {
  const [collapsed, setCollapsed] = useState(false);
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
    if (['requests', 'zones', 'registryReports', 'settings'].includes(target)) { setSection(target); return; }
    setSection(null); go(target);
  };
  const active = section || screen;
  const totals = summary?.totals || {};
  const coops = summary?.cooperatives || [];
  const requests = summary?.requests || [];
  const activity = summary?.activity || [];
  const online = connectionStatus === 'online';
  const count = (key) => loading && !summary ? '—' : totals[key] ?? '—';
  const exportRegistry = () => {
    const lines = [['Categoría', 'Cantidad'], ...metricCards.map(([, key, title]) => [title, totals[key] ?? 0])];
    const csv = '\uFEFF' + lines.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'Coffee-Fly-registros.csv'; link.click(); URL.revokeObjectURL(url);
  };
  return <div className={`registrar-app ${collapsed ? 'reg-collapsed' : ''}`}>
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
          <section className="reg-metrics" aria-label="Resumen de registros">{metricCards.map(([icon, key, label, link, target], index) => <article className="reg-metric" key={key}><div className={`reg-disc disc-${index}`}><Icon name={icon} size={39}/></div><div><strong className="reg-metric-value">{count(key)}</strong><p>{label}</p><button className="reg-text-button" onClick={() => navigate(target)}>{link}<Icon name="arrow" size={16}/></button></div></article>)}</section>
          <div className="reg-dashboard-grid">
            <section className="reg-card reg-actions"><Header icon="clipboard" title="Acciones rápidas"/><div className="reg-action-grid">{quickActions.map(([icon, title, description, target], index) => <button key={target} className={`reg-quick quick-${index}`} onClick={() => navigate(target)}><Icon name={icon} size={48}/><strong>{title}</strong><span>{description}</span></button>)}</div></section>
            <section className="reg-card reg-roles"><Header icon="people" title="Usuarios y roles" action={<Icon name="gear" size={16}/>} onAction={() => navigate('users')}/><p className="reg-subtitle">Gestiona los accesos al sistema.</p><div className="reg-role-list">{roles.map(([icon, label, key]) => <button key={key} onClick={() => navigate(key === 'caficultores' ? 'registrarFarmers' : key === 'conductores' ? 'registrarDrivers' : 'users')}><Icon name={icon} size={18}/><span>{label}</span><span>{key === 'administradores' ? '—' : count(key)}</span></button>)}</div><button className="reg-green-button" onClick={() => navigate('users')}>Gestionar usuarios <Icon name="arrow" size={15}/></button></section>
            <section className="reg-card reg-system"><Header icon="pulse" title="Estado del sistema" action={<Badge tone={online ? 'green' : 'amber'}>{online ? 'Operativo' : 'Revisar'}</Badge>} onAction={onRefresh}/><div className="reg-system-list">{[['database', 'Plataforma', online ? 'En línea' : 'Sin conexión', online], ['database', 'Base de datos', summary && !error ? 'Disponible' : 'Sin verificar', summary && !error], ['pin', 'Servicios GPS', 'Según dispositivo', false], ['bell', 'Notificaciones', 'Disponible', true]].map(([icon, label, status, okay]) => <div key={label}><Icon name={icon} size={17}/><span>{label}</span><span className="reg-system-state"><i className={okay ? 'ok' : ''}>{okay ? '✓' : '•'}</i>{status}</span></div>)}</div></section>
            <section className="reg-card reg-coops"><Header icon="people" title="Cooperativas recientes" action="Ver todas" onAction={() => navigate('cooperatives')}/><div className="reg-table-scroll"><table><thead><tr><th>Nombre</th><th>NIT</th><th>Caficultores</th><th>Ubicación</th><th>Estado</th></tr></thead><tbody>{coops.slice(0, 5).map((coop, index) => <tr key={coop.id_cooperativa}><td><span className={`reg-coop-logo coop-logo-${index}`}><Icon name="leaf" size={18}/></span>{coop.nombre}</td><td>{coop.nit || '—'}</td><td>{coop.caficultores ?? '—'}</td><td>{coop.ubicacion_texto || [coop.ubicacion?.ciudad, coop.ubicacion?.departamento].filter(Boolean).join(', ') || 'Sin ubicación'}</td><td><Badge>{coop.estado || 'Registrada'}</Badge></td></tr>)}{!coops.length && <tr><td colSpan={5} className="reg-empty">{loading ? 'Cargando cooperativas…' : 'Aún no hay cooperativas registradas.'}</td></tr>}</tbody></table></div></section>
            <section className="reg-card reg-requests"><Header icon="clipboard" title="Solicitudes de transporte" action="Ver todas" onAction={() => navigate('requests')}/><div className="reg-table-scroll"><table><thead><tr><th># Solicitud</th><th>Caficultor</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>{requests.slice(0, 5).map((request) => <tr key={request.id}><td>{request.id}</td><td>{request.caficultor}</td><td>{request.fecha}</td><td><Badge tone={request.tone}>{request.estado}</Badge></td></tr>)}{!requests.length && <tr><td colSpan={4} className="reg-empty">Las solicitudes de transporte son gestionadas por el coordinador.</td></tr>}</tbody></table></div></section>
            <section className="reg-card reg-activity"><Header icon="clock" title="Actividad reciente" action="Ver todas" onAction={() => setSection('activity')}/><div className="reg-activity-list">{activity.slice(0, 5).map((item, index) => <div className="reg-activity-item" key={item.id || index}><span className={`reg-disc disc-${index % 4}`}><Icon name={item.icon} size={24}/></span><div><strong>{item.title}</strong><span>{item.detail}</span><small>{item.time || 'Registro disponible'}</small></div></div>)}{!activity.length && <p className="reg-empty">Los registros aparecerán aquí.</p>}</div></section>
          </div>
        </> : <section className="reg-module">{children}</section>}
        <footer className="reg-footer"><span><Icon name="leaf" size={27}/><strong>Coffee Fly</strong><i/>Tu café viaja</span><span>Conectando personas, cosechas y destinos.</span></footer>
      </main>
    </div>
    {section && <div className="reg-modal-backdrop" onClick={() => setSection(null)}><section className="reg-modal" role="dialog" aria-modal="true" aria-labelledby="reg-modal-title" onClick={(event) => event.stopPropagation()}><button autoFocus className="reg-modal-close" onClick={() => setSection(null)} aria-label="Cerrar">×</button><h2 id="reg-modal-title">{menu.find(([, , key]) => key === section)?.[1] || 'Actividad reciente'}</h2>
      {section === 'requests' && <p>El coordinador gestiona las solicitudes y asigna el transporte. Desde tu perfil puedes mantener actualizados los caficultores, conductores, cooperativas y vehículos.</p>}
      {section === 'zones' && <><p>Gestiona las ubicaciones de las cooperativas que sirven como destinos de transporte.</p><button className="reg-green-button" onClick={() => navigate('cooperatives')}>Abrir cooperativas y ubicación</button></>}
      {section === 'registryReports' && <><p>Descarga el resumen de registros actualmente disponibles en tu panel.</p><button className="reg-green-button" disabled={!summary} onClick={exportRegistry}>Descargar resumen CSV</button></>}
      {section === 'settings' && <><p><strong>{name}</strong><br/>{user?.correo_usuario}<br/>Rol: Registrador</p><p>Gestiona los datos y accesos desde Usuarios y Roles.</p><button className="reg-green-button" onClick={() => navigate('users')}>Gestionar cuentas</button><button className="reg-text-button" onClick={onRefresh}>Actualizar datos del panel</button><button className="reg-text-button" onClick={onLogout}>Cerrar sesión</button></>}
      {section === 'activity' && <><p>Últimos registros disponibles. No se muestran horas de creación porque el sistema no las registra para estas entidades.</p>{activity.map((item, index) => <p key={index}><strong>{item.title}</strong><br/>{item.detail}</p>)}</>}
    </section></div>}
  </div>;
}
