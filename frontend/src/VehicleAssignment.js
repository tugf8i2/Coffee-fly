import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from './config';

export default function VehicleAssignment({ go, token, styles }) {
  const [deliveries, setDeliveries] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [deliveriesResponse, vehiclesResponse, driversResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/entregas/pendientes-asignacion`, { headers }),
        fetch(`${API_BASE_URL}/entregas/vehiculos-disponibles`, { headers }),
        fetch(`${API_BASE_URL}/entregas/conductores-disponibles`, { headers }),
      ]);
      const [deliveriesData, vehiclesData, driversData] = await Promise.all([
        deliveriesResponse.json(), vehiclesResponse.json(), driversResponse.json(),
      ]);
      if (!deliveriesResponse.ok) throw Error(deliveriesData.detail || 'No se pudieron cargar las entregas pendientes.');
      if (!vehiclesResponse.ok) throw Error(vehiclesData.detail || 'No se pudieron cargar los vehículos disponibles.');
      if (!driversResponse.ok) throw Error(driversData.detail || 'No se pudieron cargar los conductores.');
      setDeliveries(deliveriesData);
      setVehicles(vehiclesData);
      setDrivers(driversData);
    } catch (error) { setMessage(error.message); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const assign = async () => {
    if (!selectedDelivery || !selectedVehicle || !selectedDriver) {
      return setMessage('Selecciona una entrega, un vehículo y un conductor.');
    }
    if (selectedDelivery.cantidad_kg > selectedVehicle.capacidad_disponible_kg) {
      return setMessage(`La entrega supera las ${(selectedVehicle.capacidad_disponible_kg / 1000).toFixed(2)} t disponibles en el vehículo.`);
    }
    try {
      const response = await fetch(`${API_BASE_URL}/entregas/${selectedDelivery.id_entrega}/asignar-vehiculo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vehiculo_id: selectedVehicle.id_vehiculo,
          conductor_id: selectedDriver.id_conductor,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo asignar el vehículo.');
      setMessage(`Vehículo ${selectedVehicle.placa} y conductor ${selectedDriver.nombre_conductor} asignados correctamente.`);
      setSelectedDelivery(null);
      setSelectedVehicle(null);
      setSelectedDriver(null);
      await load();
    } catch (error) { setMessage(error.message); }
  };

  const compatibleVehicles = selectedDelivery
    ? vehicles.filter((vehicle) => selectedDelivery.cantidad_kg <= vehicle.capacidad_disponible_kg)
    : vehicles;

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Asignación de vehículo y conductor</Text>
    <Text style={styles.muted}>Selecciona una entrega, luego un vehículo y finalmente el conductor. La carga acumulada nunca puede superar la capacidad del vehículo.</Text>
    {message ? <Text style={styles.error}>{message}</Text> : null}
    <Text style={styles.section}>Entregas pendientes</Text>
    {deliveries.map((delivery) => <TouchableOpacity key={delivery.id_entrega} style={[styles.card, selectedDelivery?.id_entrega === delivery.id_entrega && styles.cardSelected]} onPress={() => setSelectedDelivery(delivery)}>
      <Text style={styles.cardTitle}>{delivery.caficultor_nombre}</Text>
      <Text>Carga: {delivery.cantidad_kg} kg · {(delivery.cantidad_kg / 1000).toFixed(3)} t</Text>
      <Text>Entrega: {new Date(delivery.fecha_hora_entrega).toLocaleString()}</Text>
    </TouchableOpacity>)}
    {!deliveries.length ? <Text style={styles.muted}>No hay entregas pendientes de asignación.</Text> : null}
    <Text style={styles.section}>1. Asignar vehículo</Text>
    {compatibleVehicles.map((vehicle) => <TouchableOpacity key={vehicle.id_vehiculo} style={[styles.card, selectedVehicle?.id_vehiculo === vehicle.id_vehiculo && styles.cardSelected]} onPress={() => {
      setSelectedVehicle(vehicle);
      setSelectedDriver(null);
    }}>
      <Text style={styles.cardTitle}>{vehicle.placa} · {vehicle.tipo_vehiculo}</Text>
      {vehicle.modelo ? <Text>Modelo: {vehicle.modelo}</Text> : null}
      <Text>Capacidad máxima: {vehicle.capacidad_kg / 1000} t</Text>
      <Text>Carga asignada: {vehicle.carga_actual_kg / 1000} t</Text>
      <Text style={styles.muted}>Disponible: {vehicle.capacidad_disponible_kg / 1000} t</Text>
      {selectedDelivery && selectedDelivery.cantidad_kg > vehicle.capacidad_disponible_kg ? <Text style={styles.error}>No tiene capacidad para esta entrega.</Text> : null}
    </TouchableOpacity>)}
    {selectedDelivery && !compatibleVehicles.length ? <Text style={styles.error}>No hay vehículos con capacidad suficiente para esta carga.</Text> : null}
    {!selectedDelivery && !vehicles.length ? <Text style={styles.muted}>No hay vehículos disponibles.</Text> : null}
    {selectedVehicle ? <>
      <Text style={styles.section}>2. Asignar conductor</Text>
      {drivers.map((driver, index) => <TouchableOpacity key={driver.id_conductor || `incomplete-${index}`} style={[styles.card, selectedDriver?.id_conductor === driver.id_conductor && styles.cardSelected]} onPress={() => {
        if (!driver.id_conductor || !driver.tiene_foto_licencia) {
          setMessage(`${driver.nombre_conductor} necesita completar el tipo y la foto de licencia en Administración de usuarios antes de asignarlo.`);
          return;
        }
        setSelectedDriver(driver);
      }}>
        <Text style={styles.cardTitle}>{driver.nombre_conductor}</Text>
        {driver.id_conductor && driver.tiene_foto_licencia ? <Text>Licencia: {driver.licencia} · Foto verificada</Text> : <Text style={styles.error}>Perfil de conductor incompleto: faltan tipo o foto de licencia.</Text>}
      </TouchableOpacity>)}
      {!drivers.length ? <Text style={styles.muted}>No hay conductores registrados para asignar.</Text> : null}
    </> : null}
    <TouchableOpacity style={styles.primary} onPress={assign}><Text style={styles.primaryText}>Asignar vehículo</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => go('dashboard')}><Text style={styles.link}>Volver al dashboard</Text></TouchableOpacity>
  </ScrollView>;
}
