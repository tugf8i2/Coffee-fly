import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
const landscape = require('../../assets/brand/coffee-landscape.jpg');
export default function BannerCafe({ title, subtitle, eyebrow = 'COFFEE FLY · TU CAFÉ VIAJA' }) {
  const { width } = useWindowDimensions();
  return <View style={s.banner}><Image source={landscape} resizeMode="cover" style={StyleSheet.absoluteFillObject} accessible={false}/><View style={s.shade}/><View style={s.content}><Text style={s.eyebrow}>{eyebrow}</Text><Text accessibilityRole="header" style={[s.title, width < 600 && { fontSize: 25, lineHeight: 31 }]}>{title}</Text><Text style={s.subtitle}>{subtitle}</Text></View></View>;
}
const s=StyleSheet.create({banner:{position:'relative',overflow:'hidden',borderRadius:12,minHeight:176,backgroundColor:'#123f34'},shade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(3,31,23,0.72)'},content:{padding:24,gap:8},eyebrow:{fontSize:11,letterSpacing:1,color:'#d9edcf',fontWeight:'700'},title:{fontSize:30,lineHeight:36,color:'#fff',fontWeight:'700'},subtitle:{fontSize:15,lineHeight:22,color:'#f1f5ed'}});
