import { Image, StyleSheet, View } from 'react-native'
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg'

import { useTheme } from '@/theme/theme'

/** The logo's two blues, so the backdrop reads as the brand rather than the app theme. */
const DEEP = '#0F57A6'
const SKY = '#2B8BD9'

/**
 * Full-screen backdrop for the sign-in screen: a brand wash, sweeping arcs
 * that echo the swoosh in the logo, and the MI mark as a faint watermark.
 * Purely decorative, so it is hidden from screen readers and ignores touches.
 */
export function LoginBackdrop() {
  const { c, isDark } = useTheme()
  const wash = isDark ? 0.22 : 0.14

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SKY} stopOpacity={wash} />
            <Stop offset="0.45" stopColor={c.bg} stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id="glowTop" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={DEEP} stopOpacity={isDark ? 0.35 : 0.18} />
            <Stop offset="1" stopColor={DEEP} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glowBottom" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={SKY} stopOpacity={isDark ? 0.25 : 0.14} />
            <Stop offset="1" stopColor={SKY} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="swoosh" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={SKY} stopOpacity={0} />
            <Stop offset="0.5" stopColor={SKY} stopOpacity={isDark ? 0.4 : 0.28} />
            <Stop offset="1" stopColor={DEEP} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="400" height="800" fill={c.bg} />
        <Rect x="0" y="0" width="400" height="800" fill="url(#wash)" />
        <Ellipse cx="60" cy="80" rx="260" ry="220" fill="url(#glowTop)" />
        <Ellipse cx="380" cy="760" rx="240" ry="200" fill="url(#glowBottom)" />

        {/* Arcs echoing the swoosh under the MI letters */}
        <Path d="M-40 250 C 80 330, 300 330, 460 210" stroke="url(#swoosh)" strokeWidth={14} strokeLinecap="round" fill="none" />
        <Path d="M-40 278 C 90 350, 290 352, 460 246" stroke="url(#swoosh)" strokeWidth={3} strokeLinecap="round" fill="none" />
        <Path d="M-60 690 C 100 610, 280 620, 470 700" stroke="url(#swoosh)" strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>

      {/* The mark itself, large and faint, bleeding off the lower corner */}
      <Image
        source={require('../../assets/logo-mark.png')}
        resizeMode="contain"
        style={{ position: 'absolute', width: 380, height: 380, right: -130, bottom: -70, opacity: isDark ? 0.06 : 0.07, transform: [{ rotate: '-12deg' }] }}
      />
      <Image
        source={require('../../assets/logo-mark.png')}
        resizeMode="contain"
        style={{ position: 'absolute', width: 170, height: 170, left: -60, top: 110, opacity: isDark ? 0.04 : 0.05, transform: [{ rotate: '10deg' }] }}
      />
    </View>
  )
}
