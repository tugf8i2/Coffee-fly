import { useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import "../styles/Coordinador.css";
import { API_BASE_URL } from "../config";


export default function Registrador() {
  const [form, setForm] = useState({
    estado_solicitud: "pendiente",
    fecha_hora_solicitud: "",
    caficultor_id: "",
    carga_id: ""
  });

  const API = `${API_BASE_URL}/solicitudes/`;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: name === "caficultor_id" ? Number(value) : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // convertir fecha local a ISO si es necesario
      const payload = { ...form };
      if (payload.fecha_hora_solicitud) payload.fecha_hora_solicitud = new Date(payload.fecha_hora_solicitud).toISOString();

      const res = await axios.post(API, payload);
      alert("Solicitud creada: " + JSON.stringify(res.data));
      setForm({ estado_solicitud: "pendiente", fecha_hora_solicitud: "", caficultor_id: "", carga_id: "" });
    } catch (error) {
      console.error("Error creando solicitud:", error);
      alert(error.response?.data || error.message);
    }
  };

  return (
    <>
      <Navbar />

      <main className="page">
        <h1>Panel Registrador 📝</h1>

        <form onSubmit={handleSubmit} className="registrador-form">
          <label>Estado</label>
          <select name="estado_solicitud" value={form.estado_solicitud} onChange={handleChange}>
            <option value="pendiente">pendiente</option>
            <option value="en camino">en camino</option>
            <option value="entregado">entregado</option>
            <option value="cancelado">cancelado</option>
          </select>

          <label>Fecha y hora</label>
          <input type="datetime-local" name="fecha_hora_solicitud" value={form.fecha_hora_solicitud} onChange={handleChange} />

          <label>ID Caficultor</label>
          <input type="number" name="caficultor_id" value={form.caficultor_id} onChange={handleChange} />

          <label>ID Carga (UUID)</label>
          <input type="text" name="carga_id" value={form.carga_id} onChange={handleChange} />

          <button type="submit">Crear Solicitud</button>
        </form>
      </main>
    </>
  );
}
