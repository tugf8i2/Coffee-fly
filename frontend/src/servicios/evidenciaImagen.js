import * as ImagePicker from 'expo-image-picker';

const MAX_IMAGE_BYTES = 2_200_000;

function dataUri(asset) {
  if (!asset?.base64) throw new Error('No fue posible leer la imagen seleccionada.');
  const mime = asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg';
  const value = `data:${mime};base64,${asset.base64}`;
  if (value.length > MAX_IMAGE_BYTES) {
    throw new Error('La imagen supera el tamaño permitido. Recórtala o selecciona una más liviana.');
  }
  return value;
}

export async function seleccionarEvidenciaImagen({ camara = false, cuadrada = false } = {}) {
  if (camara) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Autoriza la cámara para tomar la evidencia.');
  }
  const options = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: cuadrada ? [1, 1] : [4, 3],
    quality: 0.45,
    base64: true,
    exif: false,
  };
  const result = camara
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;
  return dataUri(result.assets[0]);
}
