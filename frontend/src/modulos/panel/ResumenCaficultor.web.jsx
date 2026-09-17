import BannerCafe from '../../componentes/comunes/BannerCafe';
import React from 'react';
import Icon from './IconoRegistrador.web';
export default function ResumenCaficultor({ user, data, error, go, onRefresh }) {
  const metrics = Object.entries(data?.metricas || {});
  const actions = [['clipboard','Solicitar recolección','Registra tu carga y solicita el transporte de café.','request'],['file','Mi actividad','Consulta solicitudes, entregas y novedades en un solo lugar.','farmerDashboard'],['pin','Mi finca','Guarda el punto de recogida para tus recolecciones.','farmLocation']];
  return <div className="op-summary"><BannerCafe eyebrow="CAFICULTOR · COFFEE FLY" title={`Hola, ${user?.nombre || user?.nombre_usuario || 'caficultor'}`} subtitle="Tu cosecha, conectada con su próximo destino."/>
    {error && <div className="reg-alert" role="alert">{error}<button onClick={onRefresh}>Reintentar</button></div>}
    <section className="reg-metrics" aria-label="Resumen de recolecciones">{metrics.map(([key,value],i) => <article className="reg-metric" key={key}><span className={`reg-disc disc-${i % 4}`}><Icon name="clipboard" size={30}/></span><div><strong className="reg-metric-value">{typeof value === 'number' ? value.toLocaleString('es-CO') : value}</strong><p>{key.replaceAll('_',' ')}</p></div></article>)}</section>
    {!metrics.length && <p className="op-summary-status" role="status">{data ? 'Todavía no hay movimientos. Comienza solicitando una recolección.' : error ? 'Resumen no disponible.' : 'Cargando tu resumen…'}</p>}
    <section className="reg-card"><div className="reg-card-heading"><h2><Icon name="leaf"/>Tu cosecha</h2></div><div className="reg-action-grid">{actions.map(([icon,title,description,target],i) => <button key={target} className={`reg-quick quick-${i}`} onClick={() => go(target)}><Icon name={icon} size={36}/><strong>{title}</strong><span>{description}</span></button>)}</div></section>
    <footer className="reg-footer"><span>{data?.actualizado_en ? `Actualizado: ${new Date(data.actualizado_en).toLocaleString('es-CO')}` : 'Coffee Fly · Tu café viaja'}</span><button className="reg-text-button" onClick={onRefresh}>Actualizar resumen</button></footer>
  </div>;
}
