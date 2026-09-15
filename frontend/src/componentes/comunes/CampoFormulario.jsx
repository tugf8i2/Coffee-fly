import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function CampoFormulario({ label, icon, value, onChangeText, secureTextEntry = false, styles, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const visibilityButton = secureTextEntry ? <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
    accessibilityState={{ selected: visible }}
    onPress={() => setVisible((current) => !current)}
    style={icon ? styles.loginVisibilityButton : { position: 'absolute', right: 2, top: 2, bottom: 2, minWidth: 48, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
  >
    <View style={icon ? styles.loginEye : { width: 26, height: 17, borderWidth: 2, borderColor: '#386641', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
      <View style={icon ? styles.loginEyePupil : { width: 8, height: 8, borderRadius: 4, backgroundColor: '#386641' }} />
      {visible ? <View style={icon ? styles.loginEyeSlash : { position: 'absolute', width: 30, height: 2, backgroundColor: '#386641', transform: [{ rotate: '-40deg' }] }} /> : null}
    </View>
  </TouchableOpacity> : null;

  if (icon) return <View style={styles.field}><View style={styles.loginInputShell}>
    <View style={styles.loginInputIcon}><Text style={styles.loginInputIconText}>{icon}</Text></View>
    <View style={styles.loginInputContent}>
      <Text style={styles.loginInputLabel}>{label}</Text>
      <View style={{ position: 'relative' }}>
        <TextInput autoCapitalize={secureTextEntry ? 'none' : undefined} autoCorrect={secureTextEntry ? false : undefined} {...inputProps} accessibilityLabel={label} style={[styles.loginInput, secureTextEntry && { paddingRight: 54 }]} value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry && !visible} />
        {visibilityButton}
      </View>
    </View>
  </View></View>;

  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={{ position: 'relative' }}>
      <TextInput autoCapitalize={secureTextEntry ? 'none' : undefined} autoCorrect={secureTextEntry ? false : undefined} {...inputProps} accessibilityLabel={label} style={[styles.input, secureTextEntry && { paddingRight: 60 }]} value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry && !visible} placeholder={inputProps.placeholder || label} />
      {visibilityButton}
    </View>
  </View>;
}
