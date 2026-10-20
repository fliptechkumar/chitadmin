import * as SecureStore from 'expo-secure-store'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'

import { dark, light, type Palette } from './tokens'

export type ThemePref = 'system' | 'light' | 'dark'

type ThemeValue = {
  c: Palette
  isDark: boolean
  pref: ThemePref
  setPref: (p: ThemePref) => void
}

const PREF_KEY = 'theme-pref'
const ThemeContext = createContext<ThemeValue | null>(null)

/** Light/dark palette: light until the user picks dark or the phone setting. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const [pref, setPrefState] = useState<ThemePref>('light')

  useEffect(() => {
    SecureStore.getItemAsync(PREF_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v)
      })
      .catch(() => {})
  }, [])

  const value = useMemo<ThemeValue>(() => {
    const isDark = pref === 'system' ? system === 'dark' : pref === 'dark'
    return {
      c: isDark ? dark : light,
      isDark,
      pref,
      setPref: (p) => {
        setPrefState(p)
        SecureStore.setItemAsync(PREF_KEY, p).catch(() => {})
      },
    }
  }, [pref, system])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const v = useContext(ThemeContext)
  if (!v) throw new Error('useTheme outside ThemeProvider')
  return v
}
