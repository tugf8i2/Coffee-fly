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
  const [selectedDelivery, setSelectedDelivery] = useState(null);
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
    if (!selectedDelivery || !selectedVehicle || !selectedDriver || !selectedCooperative) {
      return setMessage('Selecciona una entrega, un vehículo, un conductor y la cooperativa de destino.');
    }
    if (selectedDelivery.cantidad_kg > selectedVehicle.capacidad_disponible_kg) {
      return setMessage(`La entrega supera las ${(selectedVehicle.capacidad_disponible_kg / 1000).toFixed(2)} t disponibles en el vehículo.`);
    }
    try {
      const response = await fetchApi(`${API_BASE_URL}/entregas/${selectedDelivery.id_entrega}/asignar-vehiculo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vehiculo_id: selectedVehicle.id_vehiculo,
          conductor_id: selectedDriver.id_conductor,
          cooperativa_id: selectedCooperative.id_cooperativa,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || 'No se pudo asignar el vehículo.');
      setMessage(`Vehículo ${selectedVehicle.placa} y conductor ${selectedDriver.nombre_conductor} asignados. La entrega sigue Pendiente hasta que el conductor inicie el viaje.`, 'success');
      setSelectedDelivery(null);
      setSelectedVehicle(null);
      setSelectedDriver(null);
      setSelectedCooperative(null);
      await load();
    } catch (error) { setMessage(error.message); }
  };

  const compatibleVehicles = selectedDelivery
    ? vehicles.filter((vehicle) => selectedDelivery.cantidad_kg <= vehicle.capacidad_disponible_kg)
    : vehicles;

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Asignación de vehículo y conductor</Text>
    <Text style={styles.muted}>Selecciona una entrega, el vehículo, el conductor y la cooperativa a la que debe llevarse la carga.</Text>
    {message ? <FeedbackMessage type={messageType}>{message}</FeedbackMessage> : null}
    <Text style={styles.section}>Entregas pendientes</Text>
    <View style={styles.grid}>{deliveries.map((delivery) => <TouchableOpacity key={delivery.id_entrega} style={[styles.card, selectedDelivery?.id_entrega === delivery.id_entrega && styles.cardSelected]} onPress={() => setSelectedDelivery(delivery)}>
      <Text style={styles.cardTitle}>{delivery.caficultor_nombre}</Text>
      <Text>Carga: {weight(delivery.cantidad_kg)}</Text>
      <Text>Entrega: {new Date(delivery.fecha_hora_entrega).toLocaleString()}</Text>
    </TouchableOpacity>)}</View>
    {!deliveries.length ? <Text style={styles.muted}>No hay entregas pendientes de asignación.</Text> : null}
    <Text style={styles.section}>1. Asignar vehículo</Text>
    <View style={styles.grid}>{compatibleVehicles.map((vehicle) => <TouchableOpacity key={vehicle.id_vehiculo} style={[styles.card, selectedVehicle?.id_vehiculo === vehicle.id_vehiculo && styles.cardSelected]} onPress={() => {
      setSelectedVehicle(vehicle);
      setSelectedDriver(null);
    }}>
      <Text style={styles.cardTitle}>{vehicle.placa} · {vehicle.tipo_vehiculo}</Text>
      {vehicle.modelo ? <Text>Modelo: {vehicle.modelo}</Text> : null}
      <Text>Capacidad máxima: {vehicle.capacidad_kg / 1000} t</Text>
      <Text>Carga asignada: {vehicle.carga_actual_kg / 1000} t</Text>
      <Text style={styles.muted}>Disponible: {vehicle.capacidad_disponible_kg / 1000} t</Text>
      {selectedDelivery && selectedDelivery.cantidad_kg > vehicle.capacidad_disponible_kg ? <Text style={styles.error}>No tiene capacidad para esta entrega.</Text> : null}
    </TouchableOpacity>)}</View>
    {selectedDelivery && !compatibleVehicles.length ? <Text style={styles.error}>No hay vehículos con capacidad suficiente para esta carga.</Text> : null}
    {!selectedDelivery && !vehicles.length ? <Text style={styles.muted}>No hay vehículos disponibles.</Text> : null}
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
    <TouchableOpacity style={styles.primary} onPress={assign}><Text style={styles.primaryText}>Asignar vehículo</Text></TouchableOpacity>
  </ScrollView>;
}
