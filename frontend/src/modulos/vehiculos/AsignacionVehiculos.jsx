import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AsignacionVista from '../coordinador/AsignacionVista';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import { tonnes, weight } from '../../servicios/presentacionCarga';
import { styles } from './AsignacionVehiculos.styles';
import usePolling from '../../ganchos/usarSondeo';
import { apiErrorMessage } from '../../servicios/mensajesApi';

export default function AsignacionVehiculos({ go, token, user, initialDeliveryId }) {
  const [deliveries, setDeliveries] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicleEligibility, setVehicleEligibility] = useState({});
  const [driverEligibility, setDriverEligibility] = useState({});
  const [checkingVehicles, setCheckingVehicles] = useState(false);
  const [checkingDrivers, setCheckingDrivers] = useState(false);
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
  const initialApplied = useRef(false);
  useEffect(() => {
    if (initialApplied.current || !initialDeliveryId) return;
    const item = deliveries.find((delivery) => delivery.id_entrega === initialDeliveryId);
    if (item) { setSelectedDeliveries([item]); initialApplied.current = true; }
  }, [deliveries, initialDeliveryId]);

  const assign = async () => {
    if (savingRef.current) return;
    if (!selectedDeliveries.length || !selectedVehicle || !selectedDriver || !selectedCooperative) {
      return setMessage('Selecciona una o varias cargas, un vehículo, un conductor y la cooperativa de destino.');
    }
    if (!selectedDriver.id_conductor || !selectedDriver.tiene_foto_licencia) return setMessage('El conductor necesita completar sus datos de licencia antes de asignarlo.');
    if (vehicleEligibility[selectedVehicle.id_vehiculo]?.compatible !== true) return setMessage('El vehículo no es compatible. Revisa la capacidad, los documentos y el estado.');
    if (driverEligibility[selectedDriver.id_conductor]?.compatible !== true) return setMessage('El conductor no es compatible. Revisa categoría y vigencia de licencia.');
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
  useEffect(() => {
    if (!selectedDeliveries.length) { setVehicleEligibility({}); return; }
    let active = true;
    setCheckingVehicles(true);
    const cooperative = selectedCooperative ? `&cooperativa_id=${selectedCooperative.id_cooperativa}` : '';
    fetchApi(`${API_BASE_URL}/vehiculos/compatibilidad?peso_kg=${selectedWeight}${cooperative}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(data, 'No se pudo verificar la capacidad.'));
      if (active) setVehicleEligibility(Object.fromEntries(data.map((item) => [item.id_vehiculo, item])));
    }).catch((error) => { if (active) setMessage(error.message); })
      .finally(() => { if (active) setCheckingVehicles(false); });
    return () => { active = false; };
  }, [selectedWeight, selectedDeliveries.length, selectedCooperative?.id_cooperativa, vehicles, token]);
  useEffect(() => {
    if (!selectedVehicle) { setDriverEligibility({}); return; }
    let active = true;
    setCheckingDrivers(true);
    const cooperative = selectedCooperative ? `?cooperativa_id=${selectedCooperative.id_cooperativa}` : '';
    fetchApi(`${API_BASE_URL}/vehiculos/${selectedVehicle.id_vehiculo}/conductores-compatibles${cooperative}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw Error(apiErrorMessage(data, 'No se pudo verificar la licencia.'));
      if (active) setDriverEligibility(Object.fromEntries(data.map((item) => [item.id_conductor, item])));
    }).catch((error) => { if (active) setMessage(error.message); })
      .finally(() => { if (active) setCheckingDrivers(false); });
    return () => { active = false; };
  }, [selectedVehicle?.id_vehiculo, selectedCooperative?.id_cooperativa, drivers, token]);
  const compatibleVehicles = vehicles;

  if (Platform.OS === 'web' && user?.rol === 'coordinador') return <AsignacionVista
    {...{deliveries, vehicles, drivers, cooperatives, selectedDeliveries, selectedVehicle, selectedDriver, selectedCooperative, setSelectedDeliveries, setSelectedVehicle, setSelectedDriver, setSelectedCooperative, selectedWeight, saving, refreshing, message, messageType, vehicleEligibility, driverEligibility, checkingVehicles, checkingDrivers}}
    onAssign={assign} onRefresh={load} onCancel={() => go('deliveries')}
    onHistory={() => go('assignmentHistory')}
    onIncomplete={(driver) => setMessage(`${driver.nombre_conductor} necesita completar el tipo y la foto de licencia en Administración de usuarios antes de asignarlo.`)}
  />;
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Asignación de vehículo y conductor</Text>
    <Text style={styles.muted}>Selecciona varias cargas para un viaje. Un vehículo en ruta admite otro viaje en cola cuando mantiene capacidad por viaje y documentación vigente.</Text>
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
    <View style={styles.grid}>{compatibleVehicles.map((vehicle) => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: selectedVehicle?.id_vehiculo === vehicle.id_vehiculo, disabled: saving || (selectedDeliveries.length > 0 && vehicleEligibility[vehicle.id_vehiculo]?.compatible !== true) }} disabled={saving || (selectedDeliveries.length > 0 && vehicleEligibility[vehicle.id_vehiculo]?.compatible !== true)} key={vehicle.id_vehiculo} style={[styles.card, selectedVehicle?.id_vehiculo === vehicle.id_vehiculo && styles.cardSelected]} onPress={() => {
      setSelectedVehicle(vehicle);
      setSelectedDriver(null);
    }}>
      <Text style={styles.cardTitle}>{vehicle.placa} · {vehicle.tipo_vehiculo}</Text>
      <Text style={vehicle.estado_vehiculo === 'en camino' ? styles.muted : styles.success}>{vehicle.estado_vehiculo === 'en camino' ? 'En viaje: la asignación quedará en espera' : 'Disponible para iniciar'}</Text>
      {vehicle.modelo ? <Text>Modelo: {vehicle.modelo}</Text> : null}
      <Text>Capacidad máxima: {vehicle.capacidad_kg / 1000} t</Text>
      <Text>Capacidad por viaje: {vehicle.capacidad_disponible_kg / 1000} t</Text>
      {selectedDeliveries.length ? <Text>Resto estimado: {vehicleEligibility[vehicle.id_vehiculo]?.capacidad_restante_kg?.toLocaleString('es-CO') ?? '—'} kg</Text> : null}
      {vehicleEligibility[vehicle.id_vehiculo]?.motivos?.map((reason) => <Text key={reason} style={styles.error}>{reason}</Text>)}
    </TouchableOpacity>)}</View>
    {checkingVehicles ? <Text style={styles.muted}>Verificando vehículos con el servidor…</Text> : null}
    {!selectedDeliveries.length && !vehicles.length ? <Text style={styles.muted}>No hay vehículos programables.</Text> : null}
    {selectedVehicle ? <>
      <Text style={styles.section}>2. Asignar conductor</Text>
      <View style={styles.grid}>{drivers.map((driver, index) => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: selectedDriver?.id_conductor === driver.id_conductor, disabled: saving || driverEligibility[driver.id_conductor]?.compatible !== true }} disabled={saving || driverEligibility[driver.id_conductor]?.compatible !== true} key={driver.id_conductor || `incomplete-${index}`} style={[styles.card, selectedDriver?.id_conductor === driver.id_conductor && styles.cardSelected]} onPress={() => {
        setSelectedDriver(driver);
      }}>
        <Text style={styles.cardTitle}>{driver.nombre_conductor}</Text>
        <Text>Licencia: {driver.licencia || 'No registrada'} · Vence: {driverEligibility[driver.id_conductor]?.fecha_vencimiento_licencia || 'sin fecha'}</Text>
        {driverEligibility[driver.id_conductor]?.motivos?.map((reason) => <Text key={reason} style={styles.error}>{reason}</Text>)}
      </TouchableOpacity>)}</View>
      {checkingDrivers ? <Text style={styles.muted}>Verificando licencias con el servidor…</Text> : null}
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
