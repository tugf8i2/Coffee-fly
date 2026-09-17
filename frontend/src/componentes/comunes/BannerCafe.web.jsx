import React from 'react';
import { Image } from 'react-native';
import landscape from '../../assets/brand/coffee-landscape.jpg';
import './MarcaCafe.css';
const src = typeof landscape === 'string' ? landscape : landscape?.uri || Image.resolveAssetSource?.(landscape)?.uri;
export default function BannerCafe({ title, subtitle, eyebrow = 'COFFEE FLY · TU CAFÉ VIAJA' }) {
  return <section className="cf-banner"><img src={src} alt=""/><div><span>{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div></section>;
}
