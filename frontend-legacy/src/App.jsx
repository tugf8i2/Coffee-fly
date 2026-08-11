import { BrowserRouter, Routes, Route } from "react-router-dom";

import Inicio from "./pages/Inicio.jsx";
import Login from "./pages/Login.jsx";
import Caficultor from "./pages/Caficultor.jsx";
import Coordinador from "./pages/Coordinador.jsx";
import Conductor from "./pages/Conductor.jsx";
import Viajes from "./pages/Viajes.jsx";
import Rutas from "./pages/Rutas.jsx";
import Registrador from "./pages/Registrador.jsx";


import Panel from "./pages/Coordinador.jsx";
import Ejemplo from "./pages/Coordinador.jsx";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/login" element={<Login />} />
        <Route path="/caficultor" element={<Caficultor />} />
        <Route path="/Coordinador" element={<Coordinador />} />
        <Route path="/Conductor" element={<Conductor />} />
        <Route path="/Viajes" element={<Viajes />} />
        <Route path="/conductor/rutas" element={<Rutas />} />
        <Route path="/conductor/viajes" element={<Viajes />} />


        <Route path="/Panel" element={<Panel />} />
        <Route path="/Ejemplo" element={<Ejemplo />} />
        <Route path="/registrador" element={<Registrador />} />
        
      </Routes>
    </BrowserRouter>
  );
}