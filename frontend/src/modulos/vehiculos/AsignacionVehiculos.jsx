import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import { tonnes, weight } from '../../servicios/presentacionCarga';
import { styles } from './AsignacionVehiculos.styles';

export default function AsignacionVehiculos({ go, token }) {
  const [deliveries, setDeliveries] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [cooperatives, setCooperatives] = useState([]);
  const [selectedDeliveries, setSelectedDeliveries] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedCooperative, setSelectedCooperative] = useState(null);
  const [message, setMessageText] = useState('');
  const [messageType, setMessageType] = useState('info');
  const setMessage = (text, type = 'error') => { setMessageText(text); setMessageType(type); };

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [deliveriesResponse, vehiclesResponse, driversResponse, cooperativesResponse] = await Promise.all([
        fetchApi(`${API_BASE_URL}/entregas/pendientes-asignacion`, { headers }),
        fetchApi(`${API_BASE_URL}/entregas/vehiculos-disponibles`, { headers }),
        fetchApi(`${API_BASE_URL}/entregas/conductores-disponibles`, { headers }),
        fetchApi(`${API_BASE_URL}/entregas/cooperativas-disponibles`, { headers }),
      ]);
      const [deliveriesData, vehiclesData, driversData, cooperativesData] = await Promise.all([
        deliveriesResponse.json(), vehiclesResponse.json(), driversResponse.json(), cooperativesResponse.json(),
      ]);
      if (!deliveriesResponse.ok) throw Error(deliveriesData.detail || 'No se pudieron cargar las entregas pendientes.');
      if (!vehiclesResponse.ok) throw Error(vehiclesData.detail || 'No se pudieron cargar los vehículos disponibles.');
      if (!driversResponse.ok) throw Error(driversData.detail || 'No se pudieron cargar los conductores.');
      if (!cooperativesResponse.ok) throw Error(cooperativesData.detail || 'No se pudieron cargar las cooperativas.');
      setDeliveries(deliveriesData);
      setVehicles(vehiclesData);
      setDrivers(driversData);
      setCooperatives(cooperativesData);
    } catch (error) { setMessage(error.message); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const assign = async () => {
    if (!selectedDeliveries.length || !selectedVehicle || !selectedDriver || !selectedCooperative) {
      return setMessage('Selecciona una o varias cargas, un vehículo, un conductor y la cooperativa de destino.');
    }
    const totalWeight = selectedDeliveries.reduce((total, delivery) => total + delivery.cantidad_kg, 0);
    if (totalWeight > selectedVehicle.capacidad_kg) {
      return setMessage(`Las cargas superan las ${(selectedVehicle.capacidad_kg / 1000).toFixed(2)} t del vehículo.`);
    }
    try {
      const response = await fetchApi(`${API_BASE_URL}/viajes/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          entrega_ids: selectedDeliveries.map((delivery) => delivery.id_entrega),
          vehiculo_id: selectedVehicle.id_vehiculo,
          conductor_id: selectedDriver.id_conductor,
          cooperativa_id: selectedCooperative.id_cooperativa,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo asignar el vehículo.');
      setMessage(data.estado_viaje === 'en_cola'
        ? `Asignación guardada en espera para el vehículo ${selectedVehicle.placa}.`
        : `${selectedDeliveries.length} carga(s) asignada(s) al vehículo ${selectedVehicle.placa}.`, 'success');
      setSelectedDeliveries([]);
      setSelectedVehicle(null);
      setSelectedDriver(null);
      setSelectedCooperative(null);
      await load();
    } catch (error) { setMessage(error.message); }
  };

  const selectedWeight = selectedDeliveries.reduce((total, delivery) => total + delivery.cantidad_kg, 0);
  const compatibleVehicles = selectedDeliveries.length
    ? vehicles.filter((vehicle) => selectedWeight <= vehicle.capacidad_kg)
    : vehicles;

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Asignación de vehículo y conductor</Text>
    <Text style={styles.muted}>Selecciona varias cargas para un viaje. Si el vehículo está ocupado, la nueva asignación quedará en espera con el conductor elegido.</Text>
    {message ? <FeedbackMessage type={messageType}>{message}</FeedbackMessage> : null}
    <Text style={styles.section}>Entregas pendientes</Text>
    <View style={styles.grid}>{deliveries.map((delivery) => {
      const selected = selectedDeliveries.some((item) => item.id_entrega === delivery.id_entrega);
      return <TouchableOpacity key={delivery.id_entrega} style={[styles.card, selected && styles.cardSelected]} onPress={() => setSelectedDeliveries((current) => selected ? current.filter((item) => item.id_entrega !== delivery.id_entrega) : [...current, delivery])}>
      <Text style={styles.cardTitle}>{delivery.caficultor_nombre}</Text>
      <Text>Carga: {weight(delivery.cantidad_kg)}</Text>
      <Text>Entrega: {new Date(delivery.fecha_hora_entrega).toLocaleString()}</Text>
      <Text style={selected ? styles.success : styles.muted}>{selected ? 'Seleccionada' : 'Toca para seleccionar'}</Text>
    </TouchableOpacity>; })}</View>
    {selectedDeliveries.length ? <Text style={styles.label}>{selectedDeliveries.length} carga(s) · Total: {weight(selectedWeight)}</Text> : null}
    {!deliveries.length ? <Text style={styles.muted}>No hay entregas pendientes de asignación.</Text> : null}
    <Text style={styles.section}>1. Asignar vehículo</Text>
    <View style={styles.grid}>{compatibleVehicles.map((vehicle) => <TouchableOpacity key={vehicle.id_vehiculo} style={[styles.card, selectedVehicle?.id_vehiculo === vehicle.id_vehiculo && styles.cardSelected]} onPress={() => {
      setSelectedVehicle(vehicle);
      setSelectedDriver(null);
    }}>
      <Text style={styles.cardTitle}>{vehicle.placa} · {vehicle.tipo_vehiculo}</Text>
      <Text style={vehicle.estado_vehiculo === 'en camino' ? styles.muted : styles.success}>{vehicle.estado_vehiculo === 'en camino' ? 'En viaje: la asignación quedará en espera' : 'Disponible para iniciar'}</Text>
      {vehicle.modelo ? <Text>Modelo: {vehicle.modelo}</Text> : null}
      <Text>Capacidad máxima: {vehicle.capacidad_kg / 1000} t</Text>
      <Text>Capacidad por viaje: {vehicle.capacidad_disponible_kg / 1000} t</Text>
       {selectedWeight > vehicle.capacidad_kg ? <Text style={styles.error}>No tiene capacidad para estas cargas.</Text> : null}
    </TouchableOpacity>)}</View>
    {selectedDeliveries.length && !compatibleVehicles.length ? <Text style={styles.error}>No hay vehículos con capacidad suficiente para estas cargas.</Text> : null}
    {!selectedDeliveries.length && !vehicles.length ? <Text style={styles.muted}>No hay vehículos programables.</Text> : null}
    {selectedVehicle ? <>
      <Text style={styles.section}>2. Asignar conductor</Text>
      <View style={styles.grid}>{drivers.map((driver, index) => <TouchableOpacity key={driver.id_conductor || `incomplete-${index}`} style={[styles.card, selectedDriver?.id_conductor === driver.id_conductor && styles.cardSelected]} onPress={() => {
        if (!driver.id_conductor || !driver.tiene_foto_licencia) {
          setMessage(`${driver.nombre_conductor} necesita completar el tipo y la foto de licencia en Administración de usuarios antes de asignarlo.`);
          return;
        }
        setSelectedDriver(driver);
      }}>
        <Text style={styles.cardTitle}>{driver.nombre_conductor}</Text>
        {driver.id_conductor && driver.tiene_foto_licencia ? <Text>Licencia: {driver.licencia} · Foto verificada</Text> : <Text style={styles.error}>Perfil de conductor incompleto: faltan tipo o foto de licencia.</Text>}
      </TouchableOpacity>)}</View>
      {!drivers.length ? <Text style={styles.muted}>No hay conductores registrados para asignar.</Text> : null}
    </> : null}
    <Text style={styles.section}>3. Cooperativa de destino</Text>
    <View style={styles.grid}>{cooperatives.map((cooperative) => <TouchableOpacity key={cooperative.id_cooperativa} style={[styles.card, selectedCooperative?.id_cooperativa === cooperative.id_cooperativa && styles.cardSelected]} onPress={() => setSelectedCooperative(cooperative)}>
      <Text style={styles.cardTitle}>{cooperative.nombre}</Text>
      <Text>{cooperative.direccion}</Text>
      <Text style={styles.muted}>{cooperative.ciudad}, {cooperative.departamento}</Text>
    </TouchableOpacity>)}</View>
    {!cooperatives.length ? <Text style={styles.error}>No hay cooperativas con ubicación registradas. El registrador debe crear una antes de asignar la entrega.</Text> : null}
    <TouchableOpacity style={styles.primary} onPress={assign}><Text style={styles.primaryText}>Asignar viaje</Text></TouchableOpacity>
  </ScrollView>;
}
