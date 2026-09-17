import usarAvisoConexion from '../../ganchos/usarAvisoConexion';
import './AvisoConexion.css';

export default function AvisoConexion({ status, children }) {
  const notice = usarAvisoConexion(status);
  return <div className="cf-connection-root">
    {children}
    {notice && <div className="cf-connection-overlay" role="alert" aria-live="assertive">
      <div className="cf-connection-card">
        <span className="cf-connection-symbol" aria-hidden="true">{notice.kind === 'offline' ? '◌' : '✓'}</span>
        <h2>{notice.kind === 'offline' ? 'Modo sin conexión activado' : 'Conexión restablecida'}</h2>
        <p>{notice.kind === 'offline'
          ? 'El GPS y los datos compatibles se guardan en este dispositivo para sincronizarlos al volver la conexión.'
          : 'Estamos sincronizando los datos pendientes automáticamente.'}</p>
        <strong>Este aviso se cierra en {notice.seconds} s</strong>
      </div>
    </div>}
  </div>;
}
