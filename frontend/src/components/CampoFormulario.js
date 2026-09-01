import { Text, TextInput, View } from 'react-native';

export default function CampoFormulario({ label, value, onChangeText, secureTextEntry = false, styles, ...inputProps }) {
  return <View><Text style={styles.label}>{label}</Text><TextInput {...inputProps} style={styles.input} value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} placeholder={label} /></View>;
}
