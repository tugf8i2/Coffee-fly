import React from 'react';
import { Image } from 'react-native';
import logo from '../../assets/brand/logo.png';
import './MarcaCafe.css';
const src = typeof logo === 'string' ? logo : logo?.uri || Image.resolveAssetSource?.(logo)?.uri;
export default function MarcaCafe({ compact = false }) {
  return <span className={`cf-brand ${compact ? 'cf-brand-compact' : ''}`}><img src={src} width="64" height="64" alt=""/><span><strong>Coffee Fly</strong>{!compact && <small>Tu café viaja</small>}</span></span>;
}
