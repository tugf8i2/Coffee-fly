import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";
import logo from "../assets/logo.png";
import { API_BASE_URL } from "../config";


export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(`${API_BASE_URL}/login`, {
        email: form.email,
        password: form.password
      });

      console.log("RESPUESTA:", res.data);

      if (res.data.error) {
        alert(res.data.error);
        return;
      }

      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      const rol = res.data.user.rol.toLowerCase();

      if (rol === "coordinador") {
        navigate("/Coordinador");
      } else if (rol === "conductor") {
        navigate("/conductor");
      } else if (rol === "caficultor") {
        navigate("/Caficultor");
      } else if (rol === "registrador") {
        navigate("/registrador");
      } else {
        navigate("/");
      }

    } catch (error) {
      console.log("ERROR LOGIN:", error);
      alert(error.response?.data?.error || "Error en login");
    }
  };

  return (
    <main className="page">

      <section className="login-container">

        {/* HEADER */}
        <header className="logo-title">
          <a href="/">
            <img src={logo} alt="Logo Coffee Fly" className="logo" />
          </a>
          <h1>Coffee Fly</h1>
        </header>

        {/* FORM */}
        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label>Correo Electrónico</label>
            <input
              type="email"
              name="email"
              placeholder="tu@correo.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="btn-submit">
            Entrar
          </button>

        </form>

        {/* NAV */}
        <nav className="register-section">
          <p className="text-back">
            Volver al <a href="/" className="link-back">Inicio</a>
          </p>
        </nav>

        {/* FOOTER */}
        <footer className="login-footer">
          <p>© 2026 Coffee Fly. Todos los derechos reservados.</p>
        </footer>

      </section>

    </main>
  );
}