import { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import "../styles/Coordinador.css";
import { API_BASE_URL } from "../config";


export default function Coordinador() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);

  const [form, setForm] = useState({
    nombre_usuario: "",
    apellido: "",
    correo_usuario: "",
    telefono_usuario: "",
    contrasena: "",
    rol_id: ""
  });

  const [editando, setEditando] = useState(null);

  // usar la ruta con slash final evita redirects 307 que a veces causan problemas
  const API = `${API_BASE_URL}/usuarios/`;
  const API_ROLES = `${API_BASE_URL}/roles/`;

  // =========================
  // LISTAR USUARIOS
  // =========================
  const listar = async () => {
    const res = await axios.get(API);
    setUsuarios(res.data);
  };

  // =========================
  // LISTAR ROLES (IMPORTANTE)
  // =========================
  const listarRoles = async () => {
    try {
      const res = await axios.get(API_ROLES);
      setRoles(res.data);
    } catch (error) {
      console.log("Error cargando roles", error);
    }
  };

  useEffect(() => {
    listar();
    listarRoles();
  }, []);

  // =========================
  // INPUT CHANGE (FIX CRÍTICO)
  // =========================
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]: name === "rol_id" ? Number(value) : value
    });
  };

  // =========================
  // CREAR
  // =========================
  const crearUsuario = async (e) => {
    e.preventDefault();

    try {
      await axios.post(API, form);
      listar();
    } catch (error) {
      console.error("Error creando usuario:", error);
      alert(error.response?.data || error.message);
      return;
    }

    setForm({
      nombre_usuario: "",
      apellido: "",
      correo_usuario: "",
      telefono_usuario: "",
      contrasena: "",
      rol_id: ""
    });

    listar();
  };

  // =========================
  // ELIMINAR
  // =========================
  const eliminar = async (id) => {
    try {
      await axios.delete(`${API}${id}`);
      listar();
    } catch (error) {
      console.error("Error eliminando:", error);
      alert(error.response?.data || error.message);
    }
  };

  // =========================
  // EDITAR
  // =========================
  const cargarEdicion = (user) => {
    setEditando(user.id_usuario);

    setForm({
      nombre_usuario: user.nombre_usuario || "",
      apellido: user.apellido || "",
      correo_usuario: user.correo_usuario || "",
      telefono_usuario: user.telefono_usuario || "",
      contrasena: "",
      rol_id: user.rol_id || ""
    });
  };

  // =========================
  // ACTUALIZAR
  // =========================
  const actualizar = async (e) => {
    e.preventDefault();

    try {
      await axios.put(`${API}${editando}`, form);
      setEditando(null);
      listar();
    } catch (error) {
      console.error("Error actualizando:", error);
      alert(error.response?.data || error.message);
      return;
    }

    setForm({
      nombre_usuario: "",
      apellido: "",
      correo_usuario: "",
      telefono_usuario: "",
      contrasena: "",
      rol_id: ""
    });

    listar();
  };

  return (
    <>
      <Navbar />

      <main className="page">

        <h1>Panel Coordinador 👨‍💼</h1>

        {/* FORM */}
        <form onSubmit={editando ? actualizar : crearUsuario}>

          <input
            name="nombre_usuario"
            placeholder="Nombre"
            value={form.nombre_usuario}
            onChange={handleChange}
          />

          <input
            name="apellido"
            placeholder="Apellido"
            value={form.apellido}
            onChange={handleChange}
          />

          <input
            name="correo_usuario"
            placeholder="Correo"
            value={form.correo_usuario}
            onChange={handleChange}
          />

          <input
            name="telefono_usuario"
            placeholder="Teléfono"
            value={form.telefono_usuario}
            onChange={handleChange}
          />

          <input
            name="contrasena"
            placeholder="Contraseña"
            value={form.contrasena}
            onChange={handleChange}
          />

          {/* =========================
              SELECT DE ROLES DINÁMICO
          ========================= */}
          <select
            name="rol_id"
            value={form.rol_id}
            onChange={handleChange}
          >
            <option value="">Selecciona un rol</option>

            {roles.map((r) => (
              <option key={r.id_rol} value={r.id_rol}>
                {r.descripcion_rol}
              </option>
            ))}
          </select>

          <button type="submit">
            {editando ? "Actualizar Usuario" : "Crear Usuario"}
          </button>

        </form>

        {/* TABLE */}
        <div className="table-container">

          <table className="custom-table">

            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id_usuario}>

                  <td>{u.id_usuario}</td>
                  <td>{u.nombre_usuario}</td>
                  <td>{u.correo_usuario}</td>
                  <td>{u.rol?.descripcion_rol}</td>

                  <td className="col-actions">
                    <button className="btn-edit" onClick={() => cargarEdicion(u)}>
                      Editar
                    </button>

                    <button className="btn-delete" onClick={() => eliminar(u.id_usuario)}>
                      Eliminar
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>

          </table>

        </div>

      </main>
    </>
  );
}