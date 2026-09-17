import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
const landscape = require('../../assets/brand/coffee-landscape.jpg');
export default function BannerCafe({ title, subtitle, eyebrow = 'COFFEE FLY · TU CAFÉ VIAJA', compact = false }) {
  const { width } = useWindowDimensions();
  const small = width < 600;
  return <View style={[s.banner, compact && s.compactBanner]}>
    <Image source={landscape} resizeMode="cover" style={compact ? [s.compactImage, small && s.compactImageSmall] : StyleSheet.absoluteFillObject} accessible={false}/>
    {!compact && <View style={s.shade}/>}
    <View style={[s.content, compact && s.compactContent, compact && small && s.compactContentSmall]}>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={[s.title, small && { fontSize: 25, lineHeight: 31 }, compact && { fontSize: small ? 20 : 24, lineHeight: small ? 25 : 29 }]}>{title}</Text>
      <Text style={[s.subtitle, compact && { fontSize: 12, lineHeight: 16 }]}>{subtitle}</Text>
    </View>
  </View>;
}
const s=StyleSheet.create({banner:{position:'relative',overflow:'hidden',borderRadius:12,minHeight:176,backgroundColor:'#123f34'},compactBanner:{minHeight:102},compactImage:{position:'absolute',right:10,top:10,width:82,height:82,borderRadius:10},compactImageSmall:{right:8,top:8,width:64,height:64},shade:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(3,31,23,0.72)'},content:{padding:24,gap:8},compactContent:{padding:14,paddingRight:106,gap:3},compactContentSmall:{padding:11,paddingRight:82},eyebrow:{fontSize:11,letterSpacing:1,color:'#d9edcf',fontWeight:'700'},title:{fontSize:30,lineHeight:36,color:'#fff',fontWeight:'700'},subtitle:{fontSize:15,lineHeight:22,color:'#f1f5ed'}});
