import { useRef, useState } from 'react'
import { Image, KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/api/auth'
import { API_URL, ApiError } from '@/api/client'
import { Icon } from '@/components/Icon'
import { LoginBackdrop } from '@/components/LoginBackdrop'
import { useOverlay } from '@/components/overlays'
import { Bold, Button, Field, InlineAlert, Txt } from '@/components/ui'
import { useTheme } from '@/theme/theme'
import { fs, radius, shadow, sp } from '@/theme/tokens'

export default function Login() {
  const { c, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const { login } = useAuth()
  const { toast } = useOverlay()
  const pwRef = useRef<TextInput>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const u = username.trim().toLowerCase()
    const next = {
      username: u ? undefined : 'Enter the route username',
      password: password ? undefined : 'Enter the password',
    }
    setErrors(next)
    setFailure('')
    if (next.username || next.password) return

    setBusy(true)
    try {
      await login(u, password)
    } catch (e) {
      setFailure(e instanceof ApiError ? e.message : 'Could not sign in. Try again.')
      setBusy(false)
    }
  }

  return (
    // Padding on Android too: release builds draw edge-to-edge, so the window
    // no longer shrinks for the keyboard and the fields would sit under it.
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior="padding">
      <LoginBackdrop />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: sp[5], paddingTop: insets.top + sp[8], paddingBottom: insets.bottom + sp[6] }}
      >
        <View style={{ alignItems: 'center', marginBottom: sp[6] }}>
          <View
            style={{
              width: 112,
              height: 112,
              borderRadius: 56,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: sp[5],
              borderWidth: 6,
              borderColor: isDark ? 'rgba(43, 139, 217, 0.18)' : 'rgba(43, 139, 217, 0.12)',
              ...shadow(2, isDark),
            }}
          >
            <Image
              source={require('../../assets/logo-mark.png')}
              accessibilityLabel="Company logo"
              resizeMode="contain"
              style={{ width: 92, height: 92 }}
            />
          </View>
          <Txt size={fs['2xl']} weight="bold" color={c.ink}>
            Welcome back
          </Txt>
          <Txt muted style={{ marginTop: 6 }} align="center">
            Sign in with your route&apos;s login to start collecting
          </Txt>
        </View>

        <View
          style={{
            backgroundColor: c.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: c.divider,
            padding: sp[5],
            ...shadow(3, isDark),
          }}
        >
          {failure ? (
            <InlineAlert tone="danger" icon="alertCircle" style={{ marginBottom: sp[4] }}>
              <Bold>Sign in failed.</Bold> {failure}
            </InlineAlert>
          ) : null}

          <Field
            label="Route username"
            icon="route"
            placeholder="e.g. michits10"
            value={username}
            onChangeText={(v) => {
              setUsername(v)
              setErrors((e) => ({ ...e, username: undefined }))
            }}
            error={errors.username}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => pwRef.current?.focus()}
            submitBehavior="submit"
          />
          <Field
            ref={pwRef}
            label="Password"
            icon="lock"
            placeholder="Enter password"
            value={password}
            onChangeText={(v) => {
              setPassword(v)
              setErrors((e) => ({ ...e, password: undefined }))
            }}
            error={errors.password}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            right={
              <Pressable onPress={() => setShow((s) => !s)} accessibilityLabel={show ? 'Hide password' : 'Show password'} hitSlop={8} style={{ padding: 6 }}>
                <Icon name={show ? 'eyeOff' : 'eye'} size={18} color={c.muted} />
              </Pressable>
            }
          />

          <Pressable onPress={() => toast('Ask your branch admin to reset the route password', 'info')} style={{ alignSelf: 'flex-end', marginTop: -sp[2], marginBottom: sp[5], paddingVertical: 4 }}>
            <Txt size={fs.sm} weight="semibold" color={c.primary}>
              Forgot password?
            </Txt>
          </Pressable>

          <Button title={busy ? 'Signing in…' : 'Sign in'} onPress={submit} loading={busy} block />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: sp[6] }}>
          <Icon name="shield" size={14} color={c.subtle} />
          <Txt size={fs.xs} color={c.subtle} numberOfLines={1}>
            {API_URL.replace(/^https?:\/\//, '')} · v1.0.0
          </Txt>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
