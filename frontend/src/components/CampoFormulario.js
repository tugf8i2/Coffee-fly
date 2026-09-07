import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function CampoFormulario({ label, value, onChangeText, secureTextEntry = false, styles, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={{ position: 'relative' }}>
    <TextInput autoCapitalize={secureTextEntry ? 'none' : undefined} autoCorrect={secureTextEntry ? false : undefined} {...inputProps} accessibilityLabel={label} style={[styles.input, secureTextEntry && { paddingRight: 60 }]} value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry && !visible} placeholder={label} />
    {secureTextEntry ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} accessibilityState={{ selected: visible }} onPress={() => setVisible((current) => !current)} style={{ position: 'absolute', right: 2, top: 2, bottom: 2, minWidth: 48, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 26, height: 17, borderWidth: 2, borderColor: '#386641', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#386641' }} />{visible ? <View style={{ position: 'absolute', width: 30, height: 2, backgroundColor: '#386641', transform: [{ rotate: '-40deg' }] }} /> : null}</View>
    </TouchableOpacity> : null}
  </View></View>;
}
