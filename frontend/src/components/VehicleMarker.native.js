import { useEffect, useRef } from 'react';
import { AnimatedRegion, Marker } from 'react-native-maps';

export default function VehicleMarker({ coordinate, description, title }) {
  const animated = useRef(new AnimatedRegion({
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    latitudeDelta: 0,
    longitudeDelta: 0,
  })).current;

  useEffect(() => {
    animated.timing({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [animated, coordinate.latitude, coordinate.longitude]);

  return (
    <Marker.Animated
      coordinate={animated}
      title={title}
      description={description}
      pinColor="#386641"
    />
  );
}
