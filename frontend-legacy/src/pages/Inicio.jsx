import Navbar from "../components/Navbar";
import "../styles/Inicio.css";

export default function Inicio() {
  return (
    <>
      <Navbar />

      <main>

        {/* HERO */}
        <section className="hero">
          <h1>Logística eficiente para el mejor café del mundo</h1>
          <p>Transportamos calidad desde el origen hasta tu destino ☕🚚</p>
        </section>

        {/* LOGÍSTICA */}
        <section id="logistica" className="section">

          <h2>Transporte y Logística del Café</h2>

          <p className="text">
            En Coffee Fly nos especializamos en el transporte seguro y eficiente del café,
            garantizando trazabilidad desde la finca hasta el destino final.
          </p>

          <div className="grid">

            <div className="card">
              <img src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7" />
              <h3>Transporte Seguro</h3>
              <p>Movemos carga con control en cada ruta.</p>
            </div>

            <div className="card">
              <img src="https://images.unsplash.com/photo-1602524813208-6c3d2f1b0c0d" />
              <h3>Distribución Nacional</h3>
              <p>Conectamos zonas cafeteras con ciudades principales.</p>
            </div>

            <div className="card">
              <img src="https://images.unsplash.com/photo-1592841200221-a6898f307baa" />
              <h3>Control de Calidad</h3>
              <p>Supervisión de temperatura y estado del producto.</p>
            </div>

          </div>
        </section>

        {/* CAFÉS */}
        <section id="cafes" className="section dark">

          <h2>Tipos de Café</h2>

          <div className="grid">

            <div className="card">
              <img src="https://images.unsplash.com/photo-1511920170033-f8396924c348" />
              <h3>Espresso</h3>
              <p>Intenso y concentrado.</p>
            </div>

            <div className="card">
              <img src="https://images.unsplash.com/photo-1521302080334-4bebac2763a6" />
              <h3>Cappuccino</h3>
              <p>Equilibrio perfecto entre leche y café.</p>
            </div>

            <div className="card">
              <img src="https://images.unsplash.com/photo-1459755486867-b55449bb39ff" />
              <h3>Latte</h3>
              <p>Suave, cremoso y aromático.</p>
            </div>

          </div>
        </section>

        {/* DATOS */}
        <section className="section">

          <h2>☕ Datos Curiosos del Café</h2>

          <div className="facts">

            <div className="fact">
              <h3>Origen</h3>
              <p>El café nació en Etiopía hace más de 1000 años.</p>
            </div>

            <div className="fact">
              <h3>Consumo</h3>
              <p>Es la segunda bebida más consumida del mundo.</p>
            </div>

            <div className="fact">
              <h3>Energía</h3>
              <p>La cafeína mejora el rendimiento mental.</p>
            </div>

          </div>
        </section>

        {/* CONTACTO */}
        <section id="contacto" className="section dark">

          <h2>Contacto</h2>
          <p>📍 Bogotá, Colombia</p>
          <p>📧 jhonatanprieto714@gmail.com</p>
          <p>📞 +57 320 461 0709</p>

        </section>

      </main>

      <footer className="footer">
        <p>© 2026 Coffee Fly - Todos los derechos reservados</p>
      </footer>
    </>
  );
}