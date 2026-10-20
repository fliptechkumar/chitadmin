import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans'
import { NavigationBar } from 'expo-navigation-bar'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import * as SystemUI from 'expo-system-ui'
import { useEffect } from 'react'
import { StatusBar } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider, useAuth } from '@/api/auth'
import { OverlayProvider } from '@/components/overlays'
import { ThemeProvider, useTheme } from '@/theme/theme'

SplashScreen.preventAutoHideAsync().catch(() => {})

export const unstable_settings = { anchor: '(tabs)' }

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  })

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <OverlayProvider>
            <Navigator fontsLoaded={fontsLoaded} />
          </OverlayProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

function Navigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { user } = useAuth()
  const { c, isDark } = useTheme()
  const ready = fontsLoaded && user !== undefined

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  // The window behind the app follows the phone's theme, so on a phone in dark
  // mode it is black and shows through the transparent status bar. Paint it
  // with the app's own background instead.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {})
  }, [c.bg])

  // Keep the splash up until fonts and the stored session are read, so the
  // login screen never flashes for someone already signed in.
  if (!ready) return null

  const signedIn = Boolean(user)
  return (
    <>
      {/* Drawn behind the app, as in a release build. Where the bar is still
          opaque (Expo Go on some phones) it would otherwise be solid black. */}
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      {/* The tab bar runs behind the system buttons, so only their colour needs
          setting. 'light' means a light bar, i.e. dark buttons. */}
      <NavigationBar style={isDark ? 'dark' : 'light'} />
      {/* Screens set their own bar style on Android (white icons unless told
          otherwise), which would override <StatusBar>, so match it here too. */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: 'slide_from_right',
          statusBarStyle: isDark ? 'light' : 'dark',
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="member/[id]" />
          <Stack.Screen name="group/[id]" />
          <Stack.Screen name="receipt/[id]" />
          <Stack.Screen name="statement" />
          <Stack.Screen name="profile" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
    </>
  )
}
