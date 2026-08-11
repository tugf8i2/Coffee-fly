import Navbar from "../components/Navbar";
import "../styles/Rutas.css";

export default function Rutas() {
  return (
    <>
      <Navbar />

      <main className="rutas-page">

        <section className="rutas-header">
          <h1>🛣️ Rutas del Conductor</h1>
          <p>Gestiona tus rutas asignadas</p>
        </section>

        <section className="rutas-grid">

          <div className="rutas-card">
            <h3>Ruta 1</h3>
            <p>Bogotá → Medellín</p>
            <button>Ver detalle</button>
          </div>

          <div className="rutas-card">
            <h3>Ruta 2</h3>
            <p>Medellín → Cali</p>
            <button>Ver detalle</button>
          </div>

        </section>

      </main>
    </>
  );
}