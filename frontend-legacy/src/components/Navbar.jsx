import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "../styles/Navbar.css";

export default function Navbar() {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const goToPanel = () => {
    if (!user?.rol) return navigate("/");

    if (user.rol === "coordinador") navigate("/coordinador");
    if (user.rol === "caficultor") navigate("/caficultor");
    if (user.rol === "conductor") navigate("/conductor");
    if (user.rol === "registrador") navigate("/registrador");
  };

  const goHome = () => {
    navigate("/");
  };

  return (
    <nav className="navbar">

      {/* IZQUIERDA */}
      <div className="navbar-left">
        <Link to="/">
          <img src={logo} className="imglogo" alt="Coffee Fly" />
        </Link>
      </div>

      {/* CENTRO */}
      <div className="navbar-center">
        <div className="brand-name">COFFEE FLY</div>
      </div>

      {/* DERECHA */}
      <div className="navbar-right">

        {!token ? (
          <Link to="/login" className="btn-login">
            Iniciar Sesión
          </Link>
        ) : (
          <div className="user-menu">

            <span>👤 {user?.nombre}</span>

            {/* 🔥 BOTÓN 1: INICIO */}
            <button onClick={goHome} className="btn-nav">
              Inicio
            </button>

            {/* 🔥 BOTÓN 2: PANEL */}
            <button onClick={goToPanel} className="btn-panel">
              Panel
            </button>

            {/* LOGOUT */}
            <button onClick={logout}>
              Salir
            </button>

          </div>
        )}

      </div>

    </nav>
  );
}