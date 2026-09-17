import React from 'react';
import { Image } from 'react-native';
import landscape from '../../assets/brand/coffee-landscape.jpg';
import './MarcaCafe.css';
import './BannerCafe.css';
const src = typeof landscape === 'string' ? landscape : landscape?.uri || Image.resolveAssetSource?.(landscape)?.uri;
export default function BannerCafe({ title, subtitle, eyebrow = 'COFFEE FLY · TU CAFÉ VIAJA', compact = false }) {
  return <section className={`cf-banner${compact ? ' cf-banner-compact' : ''}`}><img src={src} alt=""/><div><span>{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div></section>;
}
