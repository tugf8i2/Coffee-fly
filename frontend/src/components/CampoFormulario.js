import { Text, TextInput, View } from 'react-native';

export default function CampoFormulario({ label, value, onChangeText, secureTextEntry = false, styles }) {
  return <View><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} placeholder={label} /></View>;
}
