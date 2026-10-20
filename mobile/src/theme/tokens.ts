/**
 * Design tokens — a 1:1 port of the prototype's css/tokens.css. Spacing,
 * radius and type sizes are plain numbers on a 4pt grid.
 */

export const light = {
  primary: '#0B6B53',
  primaryStrong: '#08513F',
  primarySoft: '#E6F3EE',
  primaryInk: '#FFFFFF',
  accent: '#E8A33D',
  accentSoft: '#FDF3E3',

  bg: '#F4F5F7',
  surface: '#FFFFFF',
  surface2: '#F8F9FB',
  ink: '#101828',
  text: '#1D2939',
  muted: '#667085',
  subtle: '#98A2B3',
  border: '#E4E7EC',
  divider: '#EEF0F3',
  overlay: 'rgba(16, 24, 40, 0.45)',

  success: '#12875A',
  successSoft: '#E5F5EC',
  warning: '#B86E00',
  warningSoft: '#FFF3DC',
  danger: '#D93636',
  dangerSoft: '#FDECEC',
  info: '#2F6FDB',
  infoSoft: '#EAF1FD',
  violet: '#7A4BD6',
  violetSoft: '#F1EBFC',
}

export type Palette = typeof light

export const dark: Palette = {
  primary: '#3CB08C',
  primaryStrong: '#2E9576',
  primarySoft: '#143A30',
  primaryInk: '#04140F',
  accent: '#F0B458',
  accentSoft: '#3A2C14',
  bg: '#0E1217',
  surface: '#171C23',
  surface2: '#1D232B',
  ink: '#F2F4F7',
  text: '#E4E7EC',
  muted: '#98A2B3',
  subtle: '#667085',
  border: '#2A313A',
  divider: '#232931',
  overlay: 'rgba(0, 0, 0, 0.6)',
  success: '#3CC48A',
  successSoft: '#12301F',
  warning: '#F0A93C',
  warningSoft: '#36280F',
  danger: '#F06363',
  dangerSoft: '#3A1717',
  info: '#6B9DF0',
  infoSoft: '#15233B',
  violet: '#A685EE',
  violetSoft: '#251B3B',
}

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral'

/** Foreground and soft background for a status tone. */
export function toneColors(c: Palette, tone: Tone) {
  switch (tone) {
    case 'primary':
      return { fg: c.primary, bg: c.primarySoft }
    case 'success':
      return { fg: c.success, bg: c.successSoft }
    case 'warning':
      return { fg: c.warning, bg: c.warningSoft }
    case 'danger':
      return { fg: c.danger, bg: c.dangerSoft }
    case 'info':
      return { fg: c.info, bg: c.infoSoft }
    case 'violet':
      return { fg: c.violet, bg: c.violetSoft }
    default:
      return { fg: c.muted, bg: c.surface2 }
  }
}

export const fs = { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, '2xl': 24, '3xl': 30 }
export const sp = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 }
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, full: 999 }

export const font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
}

export type Weight = keyof typeof font

/** Cross-platform card shadow (sh-1 / sh-2 in the prototype). */
export const shadow = (level: 1 | 2 | 3, isDark: boolean) =>
  isDark
    ? { elevation: level * 2 }
    : {
        shadowColor: '#101828',
        shadowOpacity: level === 1 ? 0.06 : level === 2 ? 0.08 : 0.16,
        shadowRadius: level === 1 ? 3 : level === 2 ? 12 : 32,
        shadowOffset: { width: 0, height: level === 1 ? 1 : level === 2 ? 4 : 12 },
        elevation: level * 2,
      }
