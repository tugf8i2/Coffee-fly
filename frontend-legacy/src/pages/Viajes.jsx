import Navbar from "../components/Navbar";
import "../styles/Viajes.css";

export default function Viajes() {
  return (
    <>
      <Navbar />

      <main className="viajes-page">

        <section className="viajes-header">
          <h1>🚚 Viajes del Conductor</h1>
          <p>Control de viajes activos y completados</p>
        </section>

        <section className="viajes-grid">

          <div className="viajes-card">
            <h3>Viaje activo</h3>
            <p>Bogotá → Cali</p>
            <button>Ver estado</button>
          </div>

          <div className="viajes-card">
            <h3>Historial</h3>
            <p>12 viajes completados</p>
            <button>Ver historial</button>
          </div>

        </section>

      </main>
    </>
  );
}