import { Platform, StyleSheet } from 'react-native';

import { colores } from '../../estilos/colores';

export const styles = StyleSheet.create({
  watermarkStage: { position: 'absolute', zIndex: 0, left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  movingLogo: { position: 'absolute', width: Platform.OS === 'web' ? 190 : 130, height: Platform.OS === 'web' ? 190 : 130 },
  markTopLeft: { top: '-3%', left: '3%' },
  markTopRight: { top: '1%', right: '4%' },
  markMiddleLeft: { top: '37%', left: '-2%' },
  markMiddleRight: { top: '34%', right: '-1%' },
  markBottomLeft: { bottom: '-2%', left: '12%' },
  markBottomRight: { bottom: '1%', right: '10%' },
  movingSlogan: { position: 'absolute', color: colores.bosque, fontSize: Platform.OS === 'web' ? 24 : 17, lineHeight: Platform.OS === 'web' ? 30 : 23, fontWeight: '900', letterSpacing: 4 },
  sloganTop: { top: '20%', left: '18%' },
  sloganBottom: { bottom: '17%', right: '18%' },
  sloganLeft: { top: '49%', left: '4%', fontSize: Platform.OS === 'web' ? 14 : 10, letterSpacing: 2 },
  sloganRight: { top: '48%', right: '3%', fontSize: Platform.OS === 'web' ? 14 : 10, letterSpacing: 2 },
  beanCluster: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8 },
  beansTop: { top: '9%', left: '42%' },
  beansLeft: { top: '60%', left: '5%' },
  beansRight: { top: '57%', right: '5%' },
  beansBottom: { bottom: '5%', left: '43%' },
  beansUpperLeft: { top: '27%', left: '7%' },
  beansUpperRight: { top: '25%', right: '9%' },
  beansLowerLeft: { bottom: '24%', left: '18%' },
  beansLowerRight: { bottom: '23%', right: '17%' },
  coffeeBean: { width: 21, height: 32, borderRadius: 13, backgroundColor: colores.bosque, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '27deg' }] },
  beanSmall: { width: 15, height: 24, borderRadius: 10 },
  beanTiny: { width: 11, height: 18, borderRadius: 8 },
  beanTilt: { transform: [{ rotate: '-24deg' }] },
  beanGroove: { width: 2, height: '68%', borderRadius: 2, backgroundColor: colores.crema, transform: [{ rotate: '8deg' }] },
});
