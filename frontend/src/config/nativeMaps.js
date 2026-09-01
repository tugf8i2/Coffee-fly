import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isNativeMapAvailable } from './mapAvailability';

const googleMapsConfigured = Boolean(Constants.expoConfig?.extra?.googleMapsConfigured);
export const RUNNING_IN_EXPO_GO = Constants.executionEnvironment === 'storeClient';

export const NATIVE_MAP_AVAILABLE = isNativeMapAvailable(
  Platform.OS,
  googleMapsConfigured,
  RUNNING_IN_EXPO_GO,
);
