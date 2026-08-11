import Navbar from "../components/Navbar";
import "../styles/Caficultor.css";

export default function Caficultor() {
  return (
    <>
      <Navbar />

      <main className="page caficultor-page">

        {/* HEADER */}
        <section className="caf-header">
          <h1>Panel del Caficultor 🌱</h1>
          <p>Gestiona tu producción y solicitudes de café</p>
        </section>

        {/* TARJETAS PRINCIPALES */}
        <section className="caf-grid">

          <div className="caf-card">
            <h3>📦 Mis Cargas</h3>
            <p>Consulta el estado de tus cargas registradas.</p>
            <button>Ver cargas</button>
          </div>

          <div className="caf-card">
            <h3>📝 Solicitudes</h3>
            <p>Revisa las solicitudes pendientes o completadas.</p>
            <button>Ver solicitudes</button>
          </div>

          <div className="caf-card">
            <h3>📍 Ubicaciones</h3>
            <p>Administra tus puntos de recolección.</p>
            <button>Ver ubicaciones</button>
          </div>

        </section>

        {/* INFO EXTRA */}
        <section className="caf-info">
          <div className="info-box">
            <h3>📊 Estado general</h3>
            <p>Tus operaciones están activas y sincronizadas.</p>
          </div>
        </section>

      </main>
    </>
  );
}