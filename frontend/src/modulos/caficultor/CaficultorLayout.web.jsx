import React, { useEffect, useState } from 'react';
import MarcoOperativo from '../panel/MarcoOperativo';
import EventMessageInbox from '../../componentes/entregas/BandejaMensajesEventos';
import { styles } from '../panel/PanelPorRol.styles';
import './SolicitarRecoleccion.css';
const menu = [['home','Inicio','dashboard'],['clipboard','Solicitar recolección','request'],['file','Mi actividad','farmerDashboard'],['pin','Mi finca','farmLocation'],['truck','Seguimiento','tracking'],['people','Servicio al cliente','support']];
export default function CaficultorLayout({ user, token, screen, go, onLogout, connectionStatus, notice, children }) {
  const [eventsOpen, setEventsOpen] = useState(false);
  useEffect(() => { setEventsOpen(false); }, [screen]);
  const activity = ['farmerDashboard','deliveryHistory'].includes(screen);
  return <MarcoOperativo user={user} role="Caficultor" menu={menu} active={activity ? 'farmerDashboard' : screen} go={target => { setEventsOpen(false); go(target); }} onLogout={onLogout} connectionStatus={connectionStatus}>
    {notice && <div className="reg-alert" role="status">{notice}</div>}
    {activity && <nav className="op-tabs" aria-label="Mi actividad"><button aria-current={!eventsOpen && screen === 'farmerDashboard' ? 'page' : undefined} onClick={() => { setEventsOpen(false); go('farmerDashboard'); }}>Solicitudes</button><button aria-current={!eventsOpen && screen === 'deliveryHistory' ? 'page' : undefined} onClick={() => { setEventsOpen(false); go('deliveryHistory'); }}>Historial de entregas</button><button aria-current={eventsOpen ? 'page' : undefined} onClick={() => setEventsOpen(true)}>Mensajes y novedades</button></nav>}
    {activity && eventsOpen ? <div className="op-events"><EventMessageInbox token={token} styles={styles} role="caficultor"/></div> : children}
  </MarcoOperativo>;
}
