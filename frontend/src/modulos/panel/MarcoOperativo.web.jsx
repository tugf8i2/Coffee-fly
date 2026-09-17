import MarcaCafe from '../../componentes/comunes/MarcaCafe.web';
import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import Icon from './IconoRegistrador.web';
import { ReferenceCrop } from './PanelRegistrador.web';
import regular from '../../assets/fonts/RobotoCondensed-Regular.ttf';
import bold from '../../assets/fonts/RobotoCondensed-Bold.ttf';
import './MarcoOperativo.css';
import './MarcoOperativoAvatar.css';
import './PreferenciasOperativas.css';
const uri = asset => typeof asset === 'string' ? asset : asset?.uri || Image.resolveAssetSource?.(asset)?.uri;
export default function MarcoOperativo({ user, role, menu, active, go, onLogout, connectionStatus, immersive = false, dark = false, children }) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 850);
  const [profileOpen, setProfileOpen] = useState(false);
  const name = [user?.nombre || user?.nombre_usuario || role, user?.apellido].filter(Boolean).join(' ');
  const navigate = target => { setProfileOpen(false); go(target); if (window.innerWidth < 850) setCollapsed(true); };
  useEffect(() => { setProfileOpen(false); }, [active]);
  useEffect(() => {
    const close = event => { if (event.key === 'Escape') { setProfileOpen(false); if (window.innerWidth < 850) setCollapsed(true); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);
  const connection = {online:'En línea', offline:'Sin conexión', checking:'Comprobando conexión'}[connectionStatus] || 'Comprobando conexión';
  return <div className={`registrar-app op-app ${collapsed ? 'reg-collapsed' : ''} ${immersive ? 'op-immersive' : ''} ${dark ? 'reg-dark op-dark' : ''}`}>
    <style>{`@font-face{font-family:Registrar;src:url('${uri(regular)}');font-weight:400;font-display:swap}@font-face{font-family:Registrar;src:url('${uri(bold)}');font-weight:600 900;font-display:swap}`}</style>
    <aside id="op-navigation" className="reg-sidebar" aria-label={`Navegación de ${role}`} inert={collapsed || immersive ? true : undefined}>
      <button className="reg-brand" onClick={() => navigate('dashboard')} aria-label="Coffee Fly, inicio"><MarcaCafe/></button>
      <div className="reg-sidebar-user"><span className="op-avatar">{role === 'Conductor' && user?.foto_perfil ? <img src={user.foto_perfil} alt={`Foto de ${name}`}/> : <Icon name={role === 'Conductor' ? 'driver' : 'farmer'} size={30}/>}</span><div><strong>{name}</strong><small>{role}</small><span className="reg-online"><i className={connectionStatus === 'online' ? '' : 'offline'}/>{connection}</span></div></div>
      <nav>{menu.map(([icon,label,target]) => <button key={target} className={active === target ? 'active' : ''} aria-current={active === target ? 'page' : undefined} onClick={() => navigate(target)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
      <div className="reg-sidebar-art"><ReferenceCrop x={0} y={731} w={241} h={293}/></div>
    </aside>
    {!collapsed && <button className="op-menu-backdrop" aria-label="Cerrar menú" onClick={() => setCollapsed(true)}/>}
    <div className="reg-workspace">
      <header className="reg-topbar"><button className="reg-icon-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Mostrar menú' : 'Ocultar menú'} aria-expanded={!collapsed} aria-controls="op-navigation"><Icon name="menu"/></button><span className="cf-mobile-brand"><MarcaCafe compact/></span><span className="op-section-title">{menu.find(([, , target]) => target === active)?.[1] || role}</span>
        <div className="reg-popover-anchor"><button className="reg-profile" aria-label={`Cuenta de ${name}, ${role}`} aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)}><span className="op-avatar">{role === 'Conductor' && user?.foto_perfil ? <img src={user.foto_perfil} alt=""/> : <Icon name="user"/>}</span><span><strong>{name}</strong><small>{role}</small></span><Icon name="chevron" size={16}/></button>{profileOpen && <div className="reg-popover"><strong>{name}</strong><p>{user?.correo_usuario || role}</p>{role === 'Conductor' && <button onClick={() => navigate('profile')}>Ver perfil e historial de viajes</button>}<button onClick={onLogout}>Cerrar sesión</button></div>}</div>
      </header>
      <main className="op-content">{children}</main>
    </div>
  </div>;
}
