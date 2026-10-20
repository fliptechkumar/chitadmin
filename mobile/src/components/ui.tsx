import { router } from 'expo-router'
import { useEffect, useState, type ReactNode, type Ref } from 'react'
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { initials } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { font, fs, radius, shadow, sp, toneColors, type Tone, type Weight } from '@/theme/tokens'
import { Icon, type IconName } from './Icon'

/**
 * Component kit: one component per block of the prototype's components.css.
 */

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

type TxtProps = TextProps & {
  size?: number
  weight?: Weight
  color?: string
  /** Shorthand for the muted grey. */
  muted?: boolean
  /** Tabular figures for amounts. */
  num?: boolean
  align?: TextStyle['textAlign']
}

export function Txt({ size = fs.md, weight = 'regular', color, muted, num, align, style, ...rest }: TxtProps) {
  const { c } = useTheme()
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: font[weight],
          fontSize: size,
          color: color ?? (muted ? c.muted : c.text),
          textAlign: align,
          fontVariant: num ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
    />
  )
}

// ---------------------------------------------------------------------------
// Screen shell, app bars, footer
// ---------------------------------------------------------------------------

export function AppBar({
  title,
  sub,
  back,
  actions,
}: {
  title: string
  sub?: string
  back?: boolean
  actions?: ReactNode
}) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.bg }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: sp[2], paddingLeft: back ? sp[1] : sp[4], paddingRight: sp[2] }}>
        {back && <IconButton name="chevL" size={24} label="Back" onPress={() => router.back()} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={fs.lg} weight="bold" color={c.ink} numberOfLines={1}>
            {title}
          </Txt>
          {sub ? (
            <Txt size={fs.xs} weight="medium" muted numberOfLines={1}>
              {sub}
            </Txt>
          ) : null}
        </View>
        {actions}
      </View>
    </View>
  )
}

export function LargeHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ paddingTop: insets.top + sp[2], paddingHorizontal: sp[4], paddingBottom: sp[3], backgroundColor: c.bg, flexDirection: 'row', alignItems: 'flex-end', gap: sp[2] }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={fs['2xl']} weight="bold" color={c.ink} style={{ letterSpacing: -0.2 }}>
          {title}
        </Txt>
        {sub ? (
          <Txt size={fs.sm} muted numberOfLines={1} style={{ marginTop: 2 }}>
            {sub}
          </Txt>
        ) : null}
      </View>
      {actions}
    </View>
  )
}

export function StickyFooter({ children }: { children: ReactNode }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.divider,
        paddingHorizontal: sp[4],
        paddingTop: sp[3],
        paddingBottom: sp[3] + insets.bottom,
      }}
    >
      {children}
    </View>
  )
}

export function Row({ children, gap = sp[3], style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export function Press({ style, children, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    // Transform is always set: removing it on release makes React Native
    // read it as null and crash ("Cannot read property 'forEach' of null").
    <Pressable {...rest} style={({ pressed }) => {
      const down = pressed && !rest.disabled
      return [style, { transform: [{ scale: down ? 0.985 : 1 }], opacity: down ? 0.92 : 1 }]
    }}>
      {children}
    </Pressable>
  )
}

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerSoft'

export function Button({
  title,
  icon,
  onPress,
  variant = 'primary',
  small,
  block,
  loading,
  disabled,
  style,
}: {
  title: string
  icon?: IconName
  onPress?: () => void
  variant?: ButtonVariant
  small?: boolean
  block?: boolean
  loading?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { c } = useTheme()
  const look: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.primary, fg: c.primaryInk },
    secondary: { bg: c.primarySoft, fg: c.primary },
    outline: { bg: c.surface, fg: c.text, border: c.border },
    ghost: { bg: 'transparent', fg: c.primary },
    danger: { bg: c.danger, fg: '#fff' },
    dangerSoft: { bg: c.dangerSoft, fg: c.danger },
  }
  const v = look[variant]
  const off = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        {
          height: small ? 36 : 48,
          paddingHorizontal: small ? sp[3] : sp[5],
          borderRadius: small ? radius.sm : radius.md,
          backgroundColor: pressed && variant === 'primary' ? c.primaryStrong : v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: sp[2],
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        block && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={v.fg} /> : icon ? <Icon name={icon} size={small ? 16 : 18} color={v.fg} strokeWidth={2} /> : null}
      <Txt size={small ? fs.sm : fs.md} weight="semibold" color={v.fg} numberOfLines={1}>
        {title}
      </Txt>
    </Pressable>
  )
}

export function IconButton({
  name,
  onPress,
  label,
  size = 20,
  filled,
  color,
}: {
  name: IconName
  onPress?: () => void
  label: string
  size?: number
  filled?: boolean
  color?: string
}) {
  const { c, isDark } = useTheme()
  const dim = filled ? 40 : 44
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        { width: dim, height: dim, borderRadius: dim / 2, alignItems: 'center', justifyContent: 'center' },
        filled && { backgroundColor: c.surface, ...shadow(1, isDark) },
        pressed && { backgroundColor: c.divider },
      ]}
    >
      <Icon name={name} size={size} color={color ?? c.text} />
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Cards, lists, rows
// ---------------------------------------------------------------------------

export function Card({ children, pad, style, onPress }: { children: ReactNode; pad?: boolean; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c, isDark } = useTheme()
  const base: StyleProp<ViewStyle> = [
    { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.divider, ...shadow(1, isDark) },
    pad && { padding: sp[4] },
    style,
  ]
  if (onPress) {
    return (
      <Press onPress={onPress} style={base}>
        {children}
      </Press>
    )
  }
  return <View style={base}>{children}</View>
}

export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c, isDark } = useTheme()
  const items = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean)
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.divider, overflow: 'hidden', ...shadow(1, isDark) }, style]}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 && <View style={{ height: 1, backgroundColor: c.divider, marginLeft: sp[4] }} />}
          {child}
        </View>
      ))}
    </View>
  )
}

export function ListRow({
  lead,
  title,
  sub,
  end,
  chevron,
  onPress,
  titleColor,
}: {
  lead?: ReactNode
  title: ReactNode
  sub?: ReactNode
  end?: ReactNode
  chevron?: boolean
  onPress?: () => void
  titleColor?: string
}) {
  const { c } = useTheme()
  const body = (
    <>
      {lead}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === 'string' ? (
          <Txt weight="semibold" color={titleColor ?? c.ink} numberOfLines={1}>
            {title}
          </Txt>
        ) : (
          title
        )}
        {sub ? (
          typeof sub === 'string' ? (
            <Txt size={fs.sm} muted numberOfLines={1} style={{ marginTop: 2 }}>
              {sub}
            </Txt>
          ) : (
            sub
          )
        ) : null}
      </View>
      {end}
      {chevron && <Icon name="chevR" size={18} color={c.subtle} />}
    </>
  )
  const style: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: sp[3], paddingVertical: 12, paddingHorizontal: sp[4], minHeight: 60 }
  if (!onPress) return <View style={style}>{body}</View>
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && { backgroundColor: c.surface2 }]}>
      {body}
    </Pressable>
  )
}

export function RowIcon({ name, tone = 'neutral', size = 20 }: { name: IconName; tone?: Tone; size?: number }) {
  const { c } = useTheme()
  const t = toneColors(c, tone)
  return (
    <View style={{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
      <Icon name={name} size={size} color={t.fg} />
    </View>
  )
}

/** Amount on the right of a row, with an optional caption under it. */
export function RowEnd({ amount, caption, color }: { amount: string; caption?: ReactNode; color?: string }) {
  const { c } = useTheme()
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Txt weight="bold" num color={color ?? c.ink}>
        {amount}
      </Txt>
      {caption ? (
        typeof caption === 'string' ? (
          <Txt size={fs.sm} muted style={{ marginTop: 2 }}>
            {caption}
          </Txt>
        ) : (
          caption
        )
      ) : null}
    </View>
  )
}

export function KV({ k, v, vColor, big, first }: { k: string; v: ReactNode; vColor?: string; big?: boolean; first?: boolean }) {
  const { c } = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, gap: 12, borderTopWidth: first ? 0 : 1, borderTopColor: c.border, borderStyle: 'dashed' }}>
      <Txt size={fs.sm} muted>
        {k}
      </Txt>
      {typeof v === 'string' ? (
        <Txt size={big ? fs.lg : fs.sm} weight={big ? 'bold' : 'semibold'} num color={vColor ?? c.ink} style={{ flexShrink: 1, textAlign: 'right' }}>
          {v}
        </Txt>
      ) : (
        v
      )}
    </View>
  )
}

export function SectionHeader({ title, link, onLink, first }: { title: string; link?: string; onLink?: () => void; first?: boolean }) {
  const { c } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: first ? 0 : sp[6], marginBottom: sp[3], marginHorizontal: 2 }}>
      <Txt weight="bold" color={c.ink}>
        {title}
      </Txt>
      {link ? (
        <Pressable onPress={onLink} hitSlop={8}>
          <Txt size={fs.sm} weight="semibold" color={c.primary}>
            {link}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Pills, chips, avatar, progress, tiles
// ---------------------------------------------------------------------------

export function Pill({ label, tone = 'neutral', dot = true, icon }: { label: string; tone?: Tone; dot?: boolean; icon?: IconName }) {
  const { c } = useTheme()
  const t = toneColors(c, tone)
  const bg = tone === 'neutral' ? c.divider : t.bg
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 8, borderRadius: radius.full, backgroundColor: bg, alignSelf: 'flex-start' }}>
      {icon ? <Icon name={icon} size={12} color={t.fg} strokeWidth={2} /> : dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.fg }} /> : null}
      <Txt size={fs.xs} weight="bold" color={t.fg} style={{ letterSpacing: 0.2 }}>
        {label}
      </Txt>
    </View>
  )
}

const STATUS: Record<string, [Tone, string]> = {
  paid: ['success', 'Up to date'],
  due: ['warning', 'Due'],
  overdue: ['danger', 'Overdue'],
  partial: ['info', 'Partial'],
  upcoming: ['neutral', 'Upcoming'],
  advance: ['violet', 'Advance'],
  completed: ['neutral', 'Completed'],
  active: ['success', 'Active'],
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const [tone, text] = STATUS[status] ?? ['neutral', status]
  return <Pill tone={tone} label={label ?? text} />
}

export function Chip({ label, active, count, icon, onPress, trailing }: { label: string; active?: boolean; count?: number; icon?: IconName; onPress?: () => void; trailing?: IconName }) {
  const { c, isDark } = useTheme()
  const activeBg = isDark ? c.primary : c.ink
  const activeFg = isDark ? c.primaryInk : c.surface
  const fg = active ? activeFg : c.text
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 36,
        paddingHorizontal: 14,
        borderRadius: radius.full,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: active ? activeBg : c.surface,
        borderWidth: 1,
        borderColor: active ? activeBg : c.border,
      }}
    >
      {icon && <Icon name={icon} size={15} color={fg} />}
      <Txt size={fs.sm} weight="semibold" color={fg}>
        {label}
      </Txt>
      {count !== undefined && (
        <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full, backgroundColor: active ? 'rgba(255,255,255,0.18)' : c.divider }}>
          <Txt size={fs.xs} weight="semibold" color={active ? activeFg : c.muted} num>
            {count}
          </Txt>
        </View>
      )}
      {trailing && <Icon name={trailing} size={14} color={fg} />}
    </Pressable>
  )
}

const AVATAR = [
  ['#E6F3EE', '#0B6B53'],
  ['#EAF1FD', '#2F6FDB'],
  ['#FFF3DC', '#B86E00'],
  ['#F1EBFC', '#7A4BD6'],
  ['#FDECEC', '#C02A2A'],
  ['#E3F6F8', '#0E7C86'],
]

export function Avatar({ name, size = 'md', round }: { name: string; size?: 'sm' | 'md' | 'lg'; round?: boolean }) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const [bg, fg] = AVATAR[h % AVATAR.length]
  const dim = size === 'lg' ? 60 : size === 'sm' ? 36 : 44
  const r = round ? dim / 2 : size === 'lg' ? 18 : size === 'sm' ? 11 : 14
  return (
    <View style={{ width: dim, height: dim, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Txt weight="bold" size={size === 'lg' ? 20 : size === 'sm' ? 13 : 15} color={fg}>
        {initials(name) || '?'}
      </Txt>
    </View>
  )
}

export function ProgressBar({ value, small, color, track }: { value: number; small?: boolean; color?: string; track?: string }) {
  const { c } = useTheme()
  const anim = useState(() => new Animated.Value(0))[0]
  const pct = Math.max(0, Math.min(1, value))
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 600, useNativeDriver: false }).start()
  }, [pct, anim])
  return (
    <View style={{ height: small ? 6 : 8, backgroundColor: track ?? c.divider, borderRadius: radius.full, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: radius.full,
          backgroundColor: color ?? c.primary,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  )
}

export function StatTile({ n, label, icon, tone, onPress, style }: { n: ReactNode; label: string; icon?: IconName; tone?: Tone; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  const t = toneColors(c, tone ?? 'neutral')
  return (
    <Card onPress={onPress} pad style={[{ flex: 1, gap: 6 }, style]}>
      {icon && (
        <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, marginBottom: 4 }}>
          <Icon name={icon} size={20} color={t.fg} />
        </View>
      )}
      {icon ? (
        <>
          <Txt size={fs.xl} weight="bold" color={c.ink} num>
            {n}
          </Txt>
          <Txt size={fs.sm} muted>
            {label}
          </Txt>
        </>
      ) : (
        <>
          <Txt size={fs.xs} muted weight="medium">
            {label}
          </Txt>
          <Txt size={fs.lg} weight="bold" color={c.ink} num numberOfLines={1} adjustsFontSizeToFit>
            {n}
          </Txt>
        </>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export function Field({
  label,
  optional,
  icon,
  prefix,
  error,
  hint,
  hintWarn,
  large,
  multiline,
  right,
  ...input
}: TextInputProps & {
  /** React 19 passes refs as props; it reaches the TextInput via the spread. */
  ref?: Ref<TextInput>
  label: string
  optional?: boolean
  icon?: IconName
  prefix?: string
  error?: string
  hint?: string
  hintWarn?: boolean
  large?: boolean
  right?: ReactNode
}) {
  const { c } = useTheme()
  const [focus, setFocus] = useState(false)
  const border = error ? c.danger : focus ? c.primary : c.border
  return (
    <View style={{ marginBottom: sp[4] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Txt size={fs.sm} weight="semibold">
          {label}
        </Txt>
        {optional && (
          <Txt size={fs.sm} weight="medium" color={c.subtle}>
            Optional
          </Txt>
        )}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: sp[2],
          minHeight: large ? 60 : 50,
          paddingHorizontal: sp[3],
          backgroundColor: c.surface,
          borderWidth: 1.5,
          borderColor: border,
          borderRadius: radius.md,
        }}
      >
        {icon && <Icon name={icon} size={18} color={c.subtle} />}
        {prefix && (
          <Txt weight="bold" size={large ? 22 : fs.md} muted>
            {prefix}
          </Txt>
        )}
        <TextInput
          {...input}
          multiline={multiline}
          placeholderTextColor={c.subtle}
          onFocus={(e) => {
            setFocus(true)
            input.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocus(false)
            input.onBlur?.(e)
          }}
          style={{
            flex: 1,
            minWidth: 0,
            color: c.text,
            fontFamily: large ? font.bold : font.regular,
            fontSize: large ? 24 : fs.md,
            paddingVertical: multiline ? 12 : 0,
            minHeight: multiline ? 64 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {right}
      </View>
      {error ? (
        <Row gap={5} style={{ marginTop: 6 }}>
          <Icon name="alertCircle" size={14} color={c.danger} strokeWidth={2} />
          <Txt size={12.5} weight="medium" color={c.danger} style={{ flex: 1 }}>
            {error}
          </Txt>
        </Row>
      ) : hint ? (
        <Txt size={12.5} color={hintWarn ? c.warning : c.muted} style={{ marginTop: 6 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  )
}

export function SelectField({ label, value, placeholder = 'Select', icon, onPress }: { label: string; value?: string; placeholder?: string; icon?: IconName; onPress: () => void }) {
  const { c } = useTheme()
  return (
    <View style={{ marginBottom: sp[3] }}>
      <Txt size={fs.sm} weight="semibold" style={{ marginBottom: 6 }}>
        {label}
      </Txt>
      <Pressable
        onPress={onPress}
        style={{ flexDirection: 'row', alignItems: 'center', gap: sp[2], height: 50, paddingHorizontal: sp[3], backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, borderRadius: radius.md }}
      >
        {icon && <Icon name={icon} size={18} color={c.subtle} />}
        <Txt numberOfLines={1} color={value ? c.text : c.subtle} style={{ flex: 1 }}>
          {value || placeholder}
        </Txt>
        <Icon name="chevD" size={18} color={c.subtle} />
      </Pressable>
    </View>
  )
}

export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const { c } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp[2], height: 46, paddingHorizontal: sp[3], backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md }}>
      <Icon name="search" size={18} color={c.subtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.subtle}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={{ flex: 1, minWidth: 0, color: c.text, fontFamily: font.regular, fontSize: fs.md, paddingVertical: 0 }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} accessibilityLabel="Clear search" hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.divider }}>
          <Icon name="x" size={14} color={c.muted} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  )
}

export function Segmented<T extends string>({ options, value, onChange, style }: { options: { value: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle> }) {
  const { c, isDark } = useTheme()
  return (
    <View style={[{ flexDirection: 'row', padding: 4, backgroundColor: c.divider, borderRadius: radius.md, gap: 2 }, style]}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[{ flex: 1, height: 38, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, on && { backgroundColor: c.surface, ...shadow(1, isDark) }]}
          >
            {o.icon && <Icon name={o.icon} size={16} color={on ? c.ink : c.muted} />}
            <Txt size={fs.sm} weight="semibold" color={on ? c.ink : c.muted}>
              {o.label}
            </Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

export function Switch({ on }: { on: boolean }) {
  const { c } = useTheme()
  const x = useState(() => new Animated.Value(on ? 18 : 0))[0]
  useEffect(() => {
    Animated.timing(x, { toValue: on ? 18 : 0, duration: 200, useNativeDriver: true }).start()
  }, [on, x])
  return (
    <View style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: on ? c.primary : c.border, padding: 3 }}>
      <Animated.View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', transform: [{ translateX: x }], elevation: 2, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }} />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Feedback: alert, empty state, skeleton, error
// ---------------------------------------------------------------------------

export function InlineAlert({ tone, icon, children, style }: { tone: 'info' | 'warning' | 'danger' | 'success'; icon: IconName; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  const t = toneColors(c, tone)
  return (
    <View style={[{ flexDirection: 'row', gap: sp[3], paddingVertical: sp[3], paddingHorizontal: sp[4], borderRadius: radius.md, backgroundColor: t.bg, alignItems: 'flex-start' }, style]}>
      <View style={{ marginTop: 1 }}>
        <Icon name={icon} size={18} color={t.fg} />
      </View>
      <Txt size={fs.sm} color={t.fg} style={{ flex: 1, lineHeight: 19 }}>
        {children}
      </Txt>
    </View>
  )
}

export function Bold({ children }: { children: ReactNode }) {
  return <RNText style={{ fontFamily: font.bold }}>{children}</RNText>
}

export function EmptyState({ icon = 'inbox', title, text, action }: { icon?: IconName; title: string; text: string; action?: ReactNode }) {
  const { c, isDark } = useTheme()
  return (
    <View style={{ alignItems: 'center', paddingVertical: sp[8], paddingHorizontal: sp[6] }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, marginBottom: sp[4], backgroundColor: c.surface, borderWidth: 1, borderColor: c.divider, alignItems: 'center', justifyContent: 'center', ...shadow(1, isDark) }}>
        <Icon name={icon} size={30} color={c.subtle} strokeWidth={1.6} />
      </View>
      <Txt size={fs.lg} weight="bold" color={c.ink} style={{ marginBottom: 6 }} align="center">
        {title}
      </Txt>
      <Txt size={fs.sm} muted align="center" style={{ maxWidth: 270, lineHeight: 20, marginBottom: sp[4] }}>
        {text}
      </Txt>
      {action}
    </View>
  )
}

export function Skeleton({ width, height, radius: r = 8, style }: { width: ViewStyle['width']; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  const pulse = useState(() => new Animated.Value(0.5))[0]
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: c.divider, opacity: pulse }, style]} />
}

export function SkeletonCards({ n = 4 }: { n?: number }) {
  return (
    <View style={{ gap: sp[3] }}>
      {Array.from({ length: n }, (_, i) => (
        <Card key={i} pad style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton width={44} height={44} radius={14} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={12} />
            <Skeleton width="85%" height={12} style={{ marginTop: 6 }} />
          </View>
        </Card>
      ))}
    </View>
  )
}

/** Full-screen error with a retry, for when a screen has nothing to show. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <EmptyState icon="alertCircle" title="Couldn't load" text={message} action={<Button small variant="outline" icon="refresh" title="Try again" onPress={onRetry} />} />
}

// ---------------------------------------------------------------------------
// Stepper (denomination counts)
// ---------------------------------------------------------------------------

export function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const { c } = useTheme()
  const [text, setText] = useState(String(value))
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setText(String(value))
  }
  const btn = (delta: number, name: IconName, a11y: string) => (
    <Pressable
      onPress={() => onChange(Math.max(0, value + delta))}
      disabled={delta < 0 && value === 0}
      accessibilityLabel={a11y}
      hitSlop={4}
      style={({ pressed }) => ({ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: pressed ? c.divider : 'transparent', opacity: delta < 0 && value === 0 ? 0.4 : 1 })}
    >
      <Icon name={name} size={16} color={c.text} strokeWidth={2.2} />
    </Pressable>
  )
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface2, padding: 2 }}>
      {btn(-1, 'minus', `One fewer ${label}`)}
      <TextInput
        value={text}
        onChangeText={(t) => {
          const clean = t.replace(/\D/g, '').slice(0, 5)
          setText(clean)
          onChange(clean ? parseInt(clean, 10) : 0)
        }}
        onFocus={() => value === 0 && setText('')}
        onBlur={() => setText(String(value))}
        keyboardType="number-pad"
        accessibilityLabel={`Number of ${label}`}
        selectTextOnFocus
        style={{ width: 52, textAlign: 'center', color: c.ink, fontFamily: font.bold, fontSize: fs.md, paddingVertical: 0 }}
      />
      {btn(1, 'plus', `One more ${label}`)}
    </View>
  )
}
