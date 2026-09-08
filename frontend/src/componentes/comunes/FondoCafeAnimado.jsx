import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Platform, View } from 'react-native';

import logo from '../../assets/brand/logo.png';
import { styles } from './FondoCafeAnimado.styles';

const Bean = ({ style }) => <View style={[styles.coffeeBean, style]}><View style={styles.beanGroove} /></View>;

export default function FondoCafeAnimado() {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let animation;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted || reduceMotion) return;
      animation = Animated.loop(Animated.sequence([
        Animated.timing(motion, { toValue: 1, duration: 4200, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(motion, { toValue: 0, duration: 4200, useNativeDriver: Platform.OS !== 'web' }),
      ]));
      animation.start();
    });
    return () => { mounted = false; animation?.stop(); };
  }, [motion]);

  const movingMark = (fromX, toX, fromY, toY, fromRotation, toRotation, opacity) => ({
    opacity,
    transform: [
      { translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [fromX, toX] }) },
      { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [fromY, toY] }) },
      { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: [fromRotation, toRotation] }) },
    ],
  });

  return <View pointerEvents="none" accessibilityElementsHidden style={styles.watermarkStage}>
    <Animated.Image source={logo} style={[styles.movingLogo, styles.markTopLeft, movingMark(-18, 32, -12, 28, '-9deg', '7deg', 0.24)]} resizeMode="contain" />
    <Animated.Image source={logo} style={[styles.movingLogo, styles.markTopRight, movingMark(22, -36, -20, 24, '8deg', '-6deg', 0.21)]} resizeMode="contain" />
    <Animated.Image source={logo} style={[styles.movingLogo, styles.markMiddleLeft, movingMark(-26, 38, 18, -22, '5deg', '-8deg', 0.2)]} resizeMode="contain" />
    <Animated.Image source={logo} style={[styles.movingLogo, styles.markMiddleRight, movingMark(30, -28, -16, 26, '-7deg', '9deg', 0.23)]} resizeMode="contain" />
    <Animated.Image source={logo} style={[styles.movingLogo, styles.markBottomLeft, movingMark(16, -34, 24, -25, '-5deg', '8deg', 0.22)]} resizeMode="contain" />
    <Animated.Image source={logo} style={[styles.movingLogo, styles.markBottomRight, movingMark(-22, 36, 16, -28, '9deg', '-7deg', 0.2)]} resizeMode="contain" />
    <Animated.Text style={[styles.movingSlogan, styles.sloganTop, movingMark(-12, 26, 8, -18, '-2deg', '2deg', 0.22)]}>COFFEE FLY</Animated.Text>
    <Animated.Text style={[styles.movingSlogan, styles.sloganBottom, movingMark(20, -24, -10, 18, '2deg', '-2deg', 0.2)]}>COFFEE FLY</Animated.Text>
    <Animated.View style={[styles.beanCluster, styles.beansTop, movingMark(14, -22, -16, 22, '-8deg', '9deg', 0.27)]}>
      <Bean style={styles.beanSmall} /><Bean /><Bean style={styles.beanTilt} />
    </Animated.View>
    <Animated.View style={[styles.beanCluster, styles.beansLeft, movingMark(-18, 28, 15, -20, '7deg', '-8deg', 0.24)]}>
      <Bean /><Bean style={[styles.beanSmall, styles.beanTilt]} />
    </Animated.View>
    <Animated.View style={[styles.beanCluster, styles.beansRight, movingMark(22, -26, -12, 24, '-6deg', '8deg', 0.25)]}>
      <Bean style={styles.beanTilt} /><Bean style={styles.beanSmall} />
    </Animated.View>
    <Animated.View style={[styles.beanCluster, styles.beansBottom, movingMark(-24, 20, 18, -22, '8deg', '-7deg', 0.26)]}>
      <Bean style={styles.beanSmall} /><Bean /><Bean style={styles.beanTilt} />
    </Animated.View>
    <Animated.View style={[styles.beanCluster, styles.beansUpperLeft, movingMark(18, -30, -18, 20, '-9deg', '6deg', 0.23)]}>
      <Bean style={[styles.beanTiny, styles.beanTilt]} /><Bean style={styles.beanSmall} /><Bean /><Bean style={styles.beanTiny} />
    </Animated.View>
    <Animated.View style={[styles.beanCluster, styles.beansUpperRight, movingMark(-20, 28, 14, -18, '8deg', '-9deg', 0.25)]}>
      <Bean /><Bean style={[styles.beanTiny, styles.beanTilt]} /><Bean style={styles.beanSmall} />
    </Animated.View>
    <Animated.View style={[styles.beanCluster, styles.beansLowerLeft, movingMark(-14, 26, -20, 16, '6deg', '-7deg', 0.25)]}>
      <Bean style={styles.beanSmall} /><Bean style={styles.beanTilt} /><Bean style={styles.beanTiny} />
    </Animated.View>
    <Animated.View style={[styles.beanCluster, styles.beansLowerRight, movingMark(24, -20, 18, -20, '-8deg', '7deg', 0.24)]}>
      <Bean style={styles.beanTiny} /><Bean /><Bean style={[styles.beanSmall, styles.beanTilt]} /><Bean style={styles.beanTiny} />
    </Animated.View>
    <Animated.Text style={[styles.movingSlogan, styles.sloganLeft, movingMark(16, -22, -12, 22, '3deg', '-3deg', 0.17)]}>COFFEE FLY</Animated.Text>
    <Animated.Text style={[styles.movingSlogan, styles.sloganRight, movingMark(-18, 24, 16, -18, '-3deg', '3deg', 0.17)]}>COFFEE FLY</Animated.Text>
  </View>;
}
