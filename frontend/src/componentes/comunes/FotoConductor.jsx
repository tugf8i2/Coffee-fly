import { Image, Text, View } from 'react-native';

export default function FotoConductor({ foto, nombre = 'Conductor', size = 44 }) {
  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: '#dcead7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };
  if (foto) return <Image source={{ uri: foto }} style={frame} accessibilityLabel={`Foto de ${nombre}`} />;
  return <View style={frame} accessibilityLabel={`Conductor ${nombre} sin foto de perfil`}>
    <Text style={{ color: '#075441', fontSize: Math.round(size * 0.4), fontWeight: '700' }}>
      {String(nombre).trim().charAt(0).toUpperCase() || 'C'}
    </Text>
  </View>;
}
