import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaInsetsContext, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/theme/theme'
import { fs, radius, shadow, sp } from '@/theme/tokens'
import { Icon, type IconName } from './Icon'
import { Button, IconButton, SearchBar, Txt } from './ui'

const EASE = Easing.bezier(0.2, 0.8, 0.2, 1)

// ---------------------------------------------------------------------------
// Bottom sheet
// ---------------------------------------------------------------------------

export function Sheet({
  visible,
  onClose,
  title,
  sub,
  children,
  footer,
  scroll = true,
}: {
  visible: boolean
  onClose: () => void
  title: string
  sub?: string
  children: ReactNode
  footer?: ReactNode
  /** Off when the body is its own list (the picker). */
  scroll?: boolean
}) {
  const { c, isDark } = useTheme()
  const { height } = useWindowDimensions()
  const [mounted, setMounted] = useState(visible)
  const fade = useState(() => new Animated.Value(0))[0]
  const slide = useState(() => new Animated.Value(height))[0]

  if (visible && !mounted) setMounted(true)

  useEffect(() => {
    if (visible) {
      slide.setValue(height)
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 240, easing: EASE, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: true }),
      ]).start()
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slide, { toValue: height, duration: 240, easing: EASE, useNativeDriver: true }),
      ]).start(() => setMounted(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (!mounted) return null

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {/* A modal is its own window on Android and runs under the system
          buttons, so its insets must be measured here, not taken from the app. */}
      <SafeAreaProvider>
        <SafeAreaInsetsContext.Consumer>
          {(insets) => (
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
              <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.overlay, opacity: fade }}>
                <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
              </Animated.View>
              <View style={{ flex: 1 }} pointerEvents="box-none" />
              <Animated.View
                style={{
                  maxHeight: height * 0.9,
                  backgroundColor: c.surface,
                  borderTopLeftRadius: radius.xl,
                  borderTopRightRadius: radius.xl,
                  transform: [{ translateY: slide }],
                  ...shadow(3, isDark),
                }}
              >
                <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center', marginTop: 8 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp[2], paddingVertical: sp[2], paddingLeft: sp[5], paddingRight: sp[2] }}>
                  <View style={{ flex: 1 }}>
                    <Txt size={fs.lg} weight="bold" color={c.ink}>
                      {title}
                    </Txt>
                    {sub ? (
                      <Txt size={fs.sm} weight="medium" muted numberOfLines={1} style={{ marginTop: 1 }}>
                        {sub}
                      </Txt>
                    ) : null}
                  </View>
                  <IconButton name="x" size={22} label="Close" onPress={onClose} />
                </View>
                {scroll ? (
                  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: sp[5], paddingTop: sp[2], paddingBottom: footer ? sp[4] : sp[4] + (insets?.bottom ?? 0) }} style={{ flexShrink: 1 }}>
                    {children}
                  </ScrollView>
                ) : (
                  <View style={{ flexShrink: 1, paddingHorizontal: sp[5], paddingBottom: footer ? 0 : (insets?.bottom ?? 0) }}>{children}</View>
                )}
                {footer ? (
                  <View style={{ paddingHorizontal: sp[5], paddingTop: sp[3], paddingBottom: sp[3] + (insets?.bottom ?? 0), borderTopWidth: 1, borderTopColor: c.divider }}>{footer}</View>
                ) : null}
              </Animated.View>
            </KeyboardAvoidingView>
          )}
        </SafeAreaInsetsContext.Consumer>
      </SafeAreaProvider>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Confirm dialog, toast and picker — imperative, via one provider
// ---------------------------------------------------------------------------

type ConfirmOptions = {
  title: string
  text?: string
  summary?: ReactNode
  ok?: string
  cancel?: string
  tone?: 'primary' | 'danger' | 'warning'
  icon?: IconName
}

type ToastTone = 'success' | 'error' | 'info'

export type PickOption = { value: string; label: string; sub?: string; lead?: ReactNode }
type PickOptions = { title: string; options: PickOption[]; value?: string | null; searchable?: boolean }

type OverlayApi = {
  confirm: (o: ConfirmOptions) => Promise<boolean>
  toast: (message: string, tone?: ToastTone) => void
  pick: (o: PickOptions) => Promise<string | null>
}

const OverlayContext = createContext<OverlayApi | null>(null)

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: ToastTone }[]>([])
  const [picker, setPicker] = useState<(PickOptions & { resolve: (v: string | null) => void }) | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const nextId = useRef(0)

  const api = useMemo<OverlayApi>(
    () => ({
      confirm: (o) => new Promise((resolve) => setDialog({ ...o, resolve })),
      toast: (message, tone = 'success') => {
        const id = ++nextId.current
        setToasts((t) => [...t, { id, message, tone }])
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
      },
      pick: (o) =>
        new Promise((resolve) => {
          setPicker({ ...o, resolve })
          setPickerOpen(true)
        }),
    }),
    [],
  )

  const finishDialog = useCallback(
    (v: boolean) => {
      dialog?.resolve(v)
      setDialog(null)
    },
    [dialog],
  )

  const finishPick = (v: string | null) => {
    picker?.resolve(v)
    setPickerOpen(false)
  }

  return (
    <OverlayContext.Provider value={api}>
      {children}
      <ConfirmDialog options={dialog} onDone={finishDialog} />
      {picker && <PickerSheet visible={pickerOpen} options={picker} onDone={finishPick} />}
      <ToastHost toasts={toasts} />
    </OverlayContext.Provider>
  )
}

export function useOverlay() {
  const v = useContext(OverlayContext)
  if (!v) throw new Error('useOverlay outside OverlayProvider')
  return v
}

function ConfirmDialog({ options, onDone }: { options: ConfirmOptions | null; onDone: (v: boolean) => void }) {
  const { c, isDark } = useTheme()
  const scale = useState(() => new Animated.Value(0.94))[0]
  const fade = useState(() => new Animated.Value(0))[0]

  useEffect(() => {
    if (!options) return
    scale.setValue(0.94)
    fade.setValue(0)
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 240, easing: EASE, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }, [options, scale, fade])

  if (!options) return null
  const tone = options.tone ?? 'primary'
  const icColors = tone === 'danger' ? [c.dangerSoft, c.danger] : tone === 'warning' ? [c.warningSoft, c.warning] : [c.primarySoft, c.primary]

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => onDone(false)}>
      <Animated.View style={{ flex: 1, backgroundColor: c.overlay, opacity: fade, alignItems: 'center', justifyContent: 'center', padding: sp[6] }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => onDone(false)} />
        <Animated.View
          accessibilityRole="alert"
          style={{ width: '100%', maxWidth: 340, backgroundColor: c.surface, borderRadius: radius.xl, paddingTop: sp[6], paddingHorizontal: sp[5], paddingBottom: sp[5], transform: [{ scale }], ...shadow(3, isDark) }}
        >
          <View style={{ width: 56, height: 56, borderRadius: 18, alignSelf: 'center', marginBottom: sp[4], alignItems: 'center', justifyContent: 'center', backgroundColor: icColors[0] }}>
            <Icon name={options.icon ?? 'info'} size={26} color={icColors[1]} />
          </View>
          <Txt size={fs.lg} weight="bold" color={c.ink} align="center" style={{ marginBottom: 6 }}>
            {options.title}
          </Txt>
          {options.text ? (
            <Txt size={fs.sm} muted align="center" style={{ lineHeight: 20, marginBottom: sp[5] }}>
              {options.text}
            </Txt>
          ) : null}
          {options.summary ? (
            <View style={{ backgroundColor: c.surface2, borderWidth: 1, borderColor: c.divider, borderRadius: radius.md, paddingHorizontal: sp[4], paddingVertical: 4, marginBottom: sp[5], marginTop: options.text ? 0 : sp[3] }}>
              {options.summary}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: sp[3] }}>
            <Button variant="outline" title={options.cancel ?? 'Cancel'} onPress={() => onDone(false)} style={{ flex: 1 }} />
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} title={options.ok ?? 'Confirm'} onPress={() => onDone(true)} style={{ flex: 1 }} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

function ToastHost({ toasts }: { toasts: { id: number; message: string; tone: ToastTone }[] }) {
  const insets = useSafeAreaInsets()
  if (!toasts.length) return null
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 8, alignItems: 'center', gap: 8, paddingHorizontal: sp[4] }}>
      {toasts.map((t) => (
        <ToastItem key={t.id} message={t.message} tone={t.tone} />
      ))}
    </View>
  )
}

function ToastItem({ message, tone }: { message: string; tone: ToastTone }) {
  const { c, isDark } = useTheme()
  const y = useState(() => new Animated.Value(-12))[0]
  const o = useState(() => new Animated.Value(0))[0]
  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: 240, easing: EASE, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start()
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(y, { toValue: -12, duration: 200, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start()
    }, 2350)
    return () => clearTimeout(t)
  }, [y, o])
  const bg = tone === 'error' ? c.danger : tone === 'info' ? c.info : c.success
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '100%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: c.ink, opacity: o, transform: [{ translateY: y }], ...shadow(3, isDark) }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={tone === 'error' ? 'x' : tone === 'info' ? 'info' : 'check'} size={14} color="#fff" strokeWidth={2.6} />
      </View>
      <Txt size={fs.sm} weight="semibold" color={c.surface} style={{ flexShrink: 1 }}>
        {message}
      </Txt>
    </Animated.View>
  )
}

function PickerSheet({ visible, options, onDone }: { visible: boolean; options: PickOptions; onDone: (v: string | null) => void }) {
  const { c } = useTheme()
  const [q, setQ] = useState('')
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) setQ('')
  }
  const ql = q.trim().toLowerCase()
  const list = ql ? options.options.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(ql)) : options.options

  return (
    <Sheet visible={visible} onClose={() => onDone(null)} title={options.title} scroll={false}>
      {options.searchable && (
        <View style={{ marginBottom: sp[2] }}>
          <SearchBar value={q} onChangeText={setQ} placeholder="Search" />
        </View>
      )}
      <FlatList
        data={list}
        keyExtractor={(o) => o.value}
        keyboardShouldPersistTaps="handled"
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingBottom: sp[4] }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.divider }} />}
        ListEmptyComponent={
          <Txt muted align="center" style={{ paddingVertical: 24 }}>
            No matches
          </Txt>
        }
        renderItem={({ item: o }) => {
          const sel = o.value === options.value
          return (
            <Pressable onPress={() => onDone(o.value)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: sp[3], paddingVertical: 12, paddingHorizontal: 4, minHeight: 52, borderRadius: radius.sm, backgroundColor: pressed ? c.surface2 : 'transparent' })}>
              {o.lead}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="semibold" color={c.ink} numberOfLines={1}>
                  {o.label}
                </Txt>
                {o.sub ? (
                  <Txt size={fs.sm} muted numberOfLines={1} style={{ marginTop: 2 }}>
                    {o.sub}
                  </Txt>
                ) : null}
              </View>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {sel && <Icon name="check" size={14} color="#fff" strokeWidth={3} />}
              </View>
            </Pressable>
          )
        }}
      />
    </Sheet>
  )
}
