import React, { useEffect, useState } from 'react';
import MarcoOperativo from '../panel/MarcoOperativo';
import EventMessageInbox from '../../componentes/entregas/BandejaMensajesEventos';
import { styles } from '../panel/PanelPorRol.styles';
import './SolicitarRecoleccion.css';
const menu = [['home','Inicio','dashboard'],['clipboard','Solicitar recolección','request'],['file','Mi actividad','farmerDashboard'],['pin','Mi finca','farmLocation'],['truck','Seguimiento','tracking'],['people','Servicio al cliente','support'],['gear','Preferencias','settings']];
export default function CaficultorLayout({ user, token, screen, go, onLogout, connectionStatus, notice, children }) {
  const [eventsOpen, setEventsOpen] = useState(false);
  const preferenceKey = `coffee-fly:caficultor:prefs:${user?.id || user?.id_usuario}`;
  const [dark, setDark] = useState(() => {
    try { return Boolean(JSON.parse(localStorage.getItem(preferenceKey) || '{}').dark); } catch { return false; }
  });
  const [preferenceMessage, setPreferenceMessage] = useState('');
  const savePreferences = () => {
    try { localStorage.setItem(preferenceKey, JSON.stringify({ dark })); setPreferenceMessage('Preferencias guardadas en este navegador.'); }
    catch { setPreferenceMessage('No fue posible guardar las preferencias.'); }
  };
  useEffect(() => { setEventsOpen(false); }, [screen]);
  const activity = ['farmerDashboard','deliveryHistory'].includes(screen);
  return <MarcoOperativo user={user} role="Caficultor" menu={menu} active={activity ? 'farmerDashboard' : screen} go={target => { setEventsOpen(false); go(target); }} onLogout={onLogout} connectionStatus={connectionStatus} dark={dark}>
    {notice && <div className="reg-alert" role="status">{notice}</div>}
    {activity && <nav className="op-tabs" aria-label="Mi actividad"><button aria-current={!eventsOpen && screen === 'farmerDashboard' ? 'page' : undefined} onClick={() => { setEventsOpen(false); go('farmerDashboard'); }}>Solicitudes</button><button aria-current={!eventsOpen && screen === 'deliveryHistory' ? 'page' : undefined} onClick={() => { setEventsOpen(false); go('deliveryHistory'); }}>Historial de entregas</button><button aria-current={eventsOpen ? 'page' : undefined} onClick={() => setEventsOpen(true)}>Mensajes y novedades</button></nav>}
    {screen === 'settings' ? <section className="reg-card" aria-labelledby="farmer-settings-title"><h2 id="farmer-settings-title">Preferencias</h2><label className="reg-setting">Modo oscuro <input type="checkbox" role="switch" checked={dark} onChange={event => setDark(event.target.checked)}/></label><button className="reg-green-button" onClick={savePreferences}>Guardar cambios</button>{preferenceMessage ? <p role="status">{preferenceMessage}</p> : null}</section> : activity && eventsOpen ? <div className="op-events"><EventMessageInbox token={token} styles={styles} role="caficultor"/></div> : children}
  </MarcoOperativo>;
}
