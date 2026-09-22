import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';

import { temaOscuroActivo } from '../../estilos/temaGlobal';

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : new Date();
}

function serializeDate(date) {
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function boundaryDate(value) {
  if (value instanceof Date) return value;
  return typeof value === 'string' && value ? parseDate(value) : undefined;
}

export default function SelectorFecha({ label, value, onChange, styles, disabled = false, minimumDate, maximumDate }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseDate(value));
  const dark = temaOscuroActivo();
  const show = () => { setDraft(parseDate(value)); setOpen(true); };
  const picker = <DateTimePicker value={draft} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
    themeVariant={dark ? 'dark' : 'light'} minimumDate={boundaryDate(minimumDate)} maximumDate={boundaryDate(maximumDate)}
    onChange={(event, date) => { if (Platform.OS === 'android') { setOpen(false); if (event.type === 'set' && date) onChange(serializeDate(date)); } else if (date) setDraft(date); }} />;

  return <View style={styles?.field}>
    {label ? <Text style={styles?.label}>{label}</Text> : null}
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label || 'Seleccionar fecha'} disabled={disabled} onPress={show} style={[styles?.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
      <Text style={{ color: dark ? '#f4fbf6' : '#17251c', fontSize: 16 }}>{value || 'Seleccionar fecha'}</Text><Text style={{ color: dark ? '#bfe8d1' : '#174f3c', fontSize: 21 }}>▣</Text>
    </TouchableOpacity>
    {Platform.OS === 'android' && open ? picker : null}
    {Platform.OS === 'ios' ? <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#001b16aa' }}><View style={{ backgroundColor: dark ? '#17382f' : '#fff', borderRadius: 18, padding: 14 }}>
      {picker}<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><TouchableOpacity onPress={() => setOpen(false)} style={styles?.secondary}><Text style={styles?.secondaryText}>Cancelar</Text></TouchableOpacity><TouchableOpacity onPress={() => { onChange(serializeDate(draft)); setOpen(false); }} style={styles?.primary}><Text style={styles?.primaryText}>Elegir fecha</Text></TouchableOpacity></View>
    </View></View></Modal> : null}
  </View>;
}
