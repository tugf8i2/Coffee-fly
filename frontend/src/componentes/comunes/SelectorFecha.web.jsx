import { Text, View } from 'react-native';

export default function SelectorFecha({ label, value, onChange, styles, disabled = false, minimumDate, maximumDate }) {
  return <View style={styles?.field}>
    {label ? <Text style={styles?.label}>{label}</Text> : null}
    <input className="coffee-date-input" type="date" aria-label={label || 'Seleccionar fecha'} value={value || ''} disabled={disabled}
      min={minimumDate instanceof Date ? minimumDate.toISOString().slice(0, 10) : minimumDate}
      max={maximumDate instanceof Date ? maximumDate.toISOString().slice(0, 10) : maximumDate}
      onChange={(event) => onChange(event.target.value)}
      style={{ width: '100%', maxWidth: 620, minHeight: 48, boxSizing: 'border-box', padding: '10px 44px 10px 14px', borderRadius: 10, fontSize: 16, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer' }} />
  </View>;
}
