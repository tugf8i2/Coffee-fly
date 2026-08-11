import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../styles/Conductor.css";

export default function Conductor() {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />

      <main className="conductor-page">

        <section className="cond-header">
          <h1>🚛 Panel del Conductor</h1>
          <p>Gestiona tus rutas y viajes</p>
        </section>

        <section className="cond-grid">

          <div className="cond-card">
            <h3>🛣️ Rutas</h3>
            <p>Consulta tus rutas asignadas</p>
            <button onClick={() => navigate("/conductor/rutas")}>
              Ver rutas
            </button>
          </div>

          <div className="cond-card">
            <h3>🚚 Viajes</h3>
            <p>Gestiona tus viajes activos</p>
            <button onClick={() => navigate("/conductor/viajes")}>
              Ver viajes
            </button>
          </div>

        </section>

      </main>
    </>
  );
}