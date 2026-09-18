import FeedbackMessage from '../../componentes/comunes/MensajeRetroalimentacion';
import { useRef, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL, fetchApi } from '../../configuracion';
import { weight } from '../../servicios/presentacionCarga';
import { fechaLocal, validarPeriodo, queryPeriodo } from '../../servicios/periodoReporte';
import { styles as defaultStyles } from './Reportes.styles';
import { coordinatorModuleStyles } from '../coordinador/Coordinador.styles';
import GraficosCoordinador from '../coordinador/GraficosCoordinador';

export default function Reportes({ token, user }) {
  const coordinator = Platform.OS === 'web' && user?.rol === 'coordinador';
  const styles = coordinator ? {...defaultStyles, ...coordinatorModuleStyles} : defaultStyles;
  const [from, setFrom] = useState(fechaLocal);
  const [to, setTo] = useState(fechaLocal);
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [busy, setBusy] = useState('');
  const busyRef = useRef(false);
  const notify = (text, type = 'error') => { setMessage(text); setMessageType(type); };
  const headers = { Authorization: `Bearer ${token}` };
  const generate = async () => {
    if (busyRef.current) return;
    const error = validarPeriodo(from, to);
    if (error) return notify(error);
    busyRef.current = true; setBusy('generate'); setMessage('');
    try {
      const response = await fetchApi(`${API_BASE_URL}/reportes/?${queryPeriodo({ desde: from, hasta: to })}`, { headers });
      const data = await response.json();
      if (!response.ok) throw Error(typeof data.detail === 'string' ? data.detail : 'No se pudo generar el reporte.');
      setReport(data);
    } catch (reason) { notify(reason.message); }
    finally { busyRef.current = false; setBusy(''); }
  };
  const exportReport = async (format) => {
    if (!report || busyRef.current) return;
    busyRef.current = true; setBusy(format); setMessage('');
    const extension = format === 'excel' ? 'xlsx' : 'pdf';
    const mime = format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';
    const filename = `CoffeeFly_${report.periodo.desde}_${report.periodo.hasta}.${extension}`;
    const url = `${API_BASE_URL}/reportes/exportar?formato=${format}&${queryPeriodo(report.periodo)}`;
    try {
      if (Platform.OS === 'web') {
        const response = await fetchApi(url, { headers, timeoutMs: 30000, allowNonJson: true });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw Error(typeof data.detail === 'string' ? data.detail : 'No se pudo exportar el reporte.');
        }
        const href = URL.createObjectURL(await response.blob());
        const anchor = document.createElement('a');
        anchor.href = href; anchor.download = filename;
        document.body.appendChild(anchor);
        try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(href), 60000); }
        notify(`Descarga de ${extension.toUpperCase()} iniciada. Revisa la carpeta Descargas.`, 'success');
      } else {
        if (!(await Sharing.isAvailableAsync())) throw Error('Este dispositivo no permite guardar o compartir archivos.');
        const file = await FileSystem.downloadAsync(url, `${FileSystem.cacheDirectory}${filename}`, { headers });
        if (file.status !== 200) throw Error('No se pudo descargar el reporte. Intenta nuevamente.');
        await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: format === 'pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet', dialogTitle: 'Guardar reporte de Coffee Fly' });
      }
    } catch (reason) { notify(reason.message); }
    finally { busyRef.current = false; setBusy(''); }
  };
  const dateField = (label, value, setValue) => <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {Platform.OS === 'web' ? <input type="date" aria-label={label} value={value} disabled={Boolean(busy)} onChange={(event) => setValue(event.target.value)} style={{ width: '100%', minHeight: 48, padding: 12, border: '1px solid #B7CBBE', borderRadius: 10, fontSize: 16, background: '#fff', color: '#23372A' }} />
      : <TextInput accessibilityLabel={label} style={styles.input} value={value} editable={!busy} onChangeText={setValue} maxLength={10} placeholder="AAAA-MM-DD" />}
  </View>;
  const section = (title, rows, fields) => <View style={styles.fullCard}>
    <Text style={styles.cardTitle}>{title}</Text>
    {rows?.length ? rows.map((row, index) => <View key={index} style={styles.history}>
      {fields.map(([field, label]) => <Text key={field}>{label}: {field === 'kilogramos' ? weight(row[field]) : row[field]}</Text>)}
    </View>) : <Text style={styles.muted}>Sin datos para el período.</Text>}
  </View>;
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Reportes operativos</Text>
    <Text style={styles.muted}>Consulta hasta 30 días y descarga los resultados en PDF o Excel. Se incluyen recolecciones no canceladas.</Text>
    {message ? <FeedbackMessage type={messageType}>{message}</FeedbackMessage> : null}
    <View style={styles.formCard}>
      <Text style={styles.cardTitle}>1. Selecciona el período</Text>
      {dateField('Desde', from, setFrom)}{dateField('Hasta', to, setTo)}
<TouchableOpacity 
  accessibilityRole="button" 
  disabled={Boolean(busy)} 
  style={[
    styles.primary, 
    { width: '100%', backgroundColor: '#075441', paddingVertical: 12, borderRadius: 8 }
  ]} 
  onPress={generate}
>
  <Text style={[styles.primaryText, { color: '#ffffff', fontWeight: '700', textAlign: 'center' }]}>
    {busy === 'generate' ? 'Consultando…' : 'Consultar reporte'}
  </Text>
</TouchableOpacity>
    </View>
    {report ? <>
      {coordinator ? <GraficosCoordinador report={report}/> : null}
      <View style={styles.fullCard}>
        <Text style={styles.cardTitle}>2. Descarga el reporte</Text>
        <Text style={styles.muted}>Período consultado: {report.periodo.desde} a {report.periodo.hasta}</Text>
        {from !== report.periodo.desde || to !== report.periodo.hasta ? <Text style={styles.muted}>Cambiaste las fechas. Pulsa «Consultar reporte» para aplicarlas; la descarga conserva el período mostrado.</Text> : null}
        <View style={styles.statusActions}>{[['pdf', 'Descargar PDF'], ['excel', 'Descargar Excel (.xlsx)']].map(([format, label]) => <TouchableOpacity key={format} accessibilityRole="button" disabled={Boolean(busy)} style={[styles.secondary, busy && styles.buttonDisabled]} onPress={() => exportReport(format)}><Text style={styles.secondaryText}>{busy === format ? 'Preparando archivo…' : label}</Text></TouchableOpacity>)}</View>
      </View>
      {section('Café por caficultor', report.cafe_por_caficultor, [['caficultor', 'Caficultor'], ['kilogramos', 'Peso']])}
      {section('Recolecciones por vehículo', report.entregas_por_vehiculo, [['vehiculo', 'Vehículo'], ['entregas', 'Recolecciones'], ['kilogramos', 'Peso']])}
      {section('Resumen diario', report.resumen_diario, [['fecha', 'Fecha'], ['entregas', 'Recolecciones'], ['kilogramos', 'Peso']])}
    </> : null}
  </ScrollView>;
}
