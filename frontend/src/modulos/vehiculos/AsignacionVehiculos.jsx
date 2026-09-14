import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import { tonnes, weight } from '../../servicios/presentacionCarga';
import { styles } from './AsignacionVehiculos.styles';
import usePolling from '../../ganchos/usarSondeo';
import { apiErrorMessage } from '../../servicios/mensajesApi';

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
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const savingRef = useRef(false);
  const loadingRef = useRef(null);
  const setMessage = (text, type = 'error') => { setMessageText(text); setMessageType(type); };

  const load = useCallback(async () => {
    if (loadingRef.current) return loadingRef.current;
    setRefreshing(true);
    const operation = (async () => { try {
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
      if (!deliveriesResponse.ok) throw Error(apiErrorMessage(deliveriesData, 'No se pudieron cargar las entregas pendientes.'));
      if (!vehiclesResponse.ok) throw Error(apiErrorMessage(vehiclesData, 'No se pudieron cargar los vehículos disponibles.'));
      if (!driversResponse.ok) throw Error(apiErrorMessage(driversData, 'No se pudieron cargar los conductores.'));
      if (!cooperativesResponse.ok) throw Error(apiErrorMessage(cooperativesData, 'No se pudieron cargar las cooperativas.'));
      setDeliveries(deliveriesData);
      setVehicles(vehiclesData);
      setDrivers(driversData);
      setCooperatives(cooperativesData);
      setSelectedDeliveries((current) => current.filter((selected) => deliveriesData.some((item) => item.id_entrega === selected.id_entrega)));
      setSelectedVehicle((current) => current && vehiclesData.some((item) => item.id_vehiculo === current.id_vehiculo) ? current : null);
      setSelectedDriver((current) => current && driversData.some((item) => item.id_conductor === current.id_conductor) ? current : null);
      setSelectedCooperative((current) => current && cooperativesData.some((item) => item.id_cooperativa === current.id_cooperativa) ? current : null);
    } catch (error) { setMessage(error.message); }
    })().finally(() => { loadingRef.current = null; setRefreshing(false); });
    loadingRef.current = operation;
    return operation;
  }, [token]);

  usePolling(load, 30000);

  const assign = async () => {
    if (savingRef.current) return;
    if (!selectedDeliveries.length || !selectedVehicle || !selectedDriver || !selectedCooperative) {
      return setMessage('Selecciona una o varias cargas, un vehículo, un conductor y la cooperativa de destino.');
    }
    const totalWeight = selectedDeliveries.reduce((total, delivery) => total + delivery.cantidad_kg, 0);
    if (totalWeight > selectedVehicle.capacidad_kg) {
      return setMessage(`Las cargas superan las ${(selectedVehicle.capacidad_kg / 1000).toFixed(2)} t del vehículo.`);
    }
    if (selectedDeliveries.length > 50) return setMessage('Un viaje admite máximo 50 cargas.');
    savingRef.current = true;
    setSaving(true);
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
      if (!response.ok) throw Error(apiErrorMessage(data, 'No se pudo asignar el vehículo.'));
      setMessage(data.estado_viaje === 'en_cola'
        ? `Asignación guardada en espera para el vehículo ${selectedVehicle.placa}.`
        : `${selectedDeliveries.length} carga(s) asignada(s) al vehículo ${selectedVehicle.placa}.`, 'success');
      setSelectedDeliveries([]);
      setSelectedVehicle(null);
      setSelectedDriver(null);
      setSelectedCooperative(null);
      await load();
    } catch (error) { setMessage(error.message); }
    finally { savingRef.current = false; setSaving(false); }
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
      return <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: saving }} disabled={saving} key={delivery.id_entrega} style={[styles.card, selected && styles.cardSelected]} onPress={() => setSelectedDeliveries((current) => selected ? current.filter((item) => item.id_entrega !== delivery.id_entrega) : [...current, delivery])}>
      <Text style={styles.cardTitle}>{delivery.caficultor_nombre}</Text>
      <Text>Carga: {weight(delivery.cantidad_kg)}</Text>
      <Text>Entrega: {new Date(delivery.fecha_hora_entrega).toLocaleString()}</Text>
      <Text style={selected ? styles.success : styles.muted}>{selected ? 'Seleccionada' : 'Toca para seleccionar'}</Text>
    </TouchableOpacity>; })}</View>
    {selectedDeliveries.length ? <Text style={styles.label}>{selectedDeliveries.length} carga(s) · Total: {weight(selectedWeight)}</Text> : null}
    {!deliveries.length ? <Text style={styles.muted}>No hay entregas pendientes de asignación.</Text> : null}
    <Text style={styles.section}>1. Asignar vehículo</Text>
    <View style={styles.grid}>{compatibleVehicles.map((vehicle) => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: selectedVehicle?.id_vehiculo === vehicle.id_vehiculo, disabled: saving }} disabled={saving} key={vehicle.id_vehiculo} style={[styles.card, selectedVehicle?.id_vehiculo === vehicle.id_vehiculo && styles.cardSelected]} onPress={() => {
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
      <View style={styles.grid}>{drivers.map((driver, index) => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: selectedDriver?.id_conductor === driver.id_conductor, disabled: saving }} accessibilityHint={!driver.id_conductor || !driver.tiene_foto_licencia ? 'Abre información sobre los datos de licencia pendientes.' : undefined} disabled={saving} key={driver.id_conductor || `incomplete-${index}`} style={[styles.card, selectedDriver?.id_conductor === driver.id_conductor && styles.cardSelected]} onPress={() => {
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
    <View style={styles.grid}>{cooperatives.map((cooperative) => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: selectedCooperative?.id_cooperativa === cooperative.id_cooperativa, disabled: saving }} disabled={saving} key={cooperative.id_cooperativa} style={[styles.card, selectedCooperative?.id_cooperativa === cooperative.id_cooperativa && styles.cardSelected]} onPress={() => setSelectedCooperative(cooperative)}>
      <Text style={styles.cardTitle}>{cooperative.nombre}</Text>
      <Text>{cooperative.direccion}</Text>
      <Text style={styles.muted}>{cooperative.ciudad}, {cooperative.departamento}</Text>
    </TouchableOpacity>)}</View>
    {!cooperatives.length ? <Text style={styles.error}>No hay cooperativas con ubicación registradas. El registrador debe crear una antes de asignar la entrega.</Text> : null}
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ busy: refreshing, disabled: refreshing || saving }} disabled={refreshing || saving} style={[styles.secondary, (refreshing || saving) && styles.buttonDisabled]} onPress={load}><Text style={styles.secondaryText}>{refreshing ? 'Actualizando…' : 'Actualizar disponibilidad'}</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ busy: saving, disabled: saving }} disabled={saving} style={[styles.primary, saving && styles.buttonDisabled]} onPress={assign}><Text style={styles.primaryText}>{saving ? 'Asignando viaje…' : 'Asignar viaje'}</Text></TouchableOpacity>
  </ScrollView>;
}
