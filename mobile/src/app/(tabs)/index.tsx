import { router } from 'expo-router'
import { useState } from 'react'
import { Image, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { Overview } from '@/api/types'
import { useApi } from '@/api/useApi'
import { Icon, type IconName } from '@/components/Icon'
import { Avatar, Card, ErrorState, IconButton, ListGroup, ListRow, Press, RowEnd, SectionHeader, Skeleton, Txt } from '@/components/ui'
import { DenominationSheet } from '@/features/DenominationSheet'
import { dLong, greeting, inr, inrShort, MODE_LABEL, timeOf, titleCase } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs, radius, shadow, sp, toneColors, type Tone } from '@/theme/tokens'

/** The summary card's navy, from the company logo; a touch lighter at night. */
const HERO = { light: '#0D3B66', dark: '#14497C' }

export default function Home() {
  const { c, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const { data, error, loading, refreshing, refresh } = useApi<Overview>('/api/v1/route/overview')
  const [denomOpen, setDenomOpen] = useState(false)

  const toCustomers = (filter: string) => router.navigate({ pathname: '/customers', params: { filter } })

  if (error && !data) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, justifyContent: 'center' }}>
        <ErrorState message={error.message} onRetry={refresh} />
      </View>
    )
  }

  const pct = data && data.today.target > 0 ? Math.min(100, Math.round((data.today.total / data.today.target) * 100)) : 0

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: sp[4], height: 56 + insets.top, flexDirection: 'row', alignItems: 'center', gap: sp[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.divider, ...shadow(1, isDark) }}>
            <Image source={require('../../../assets/logo-mark.png')} accessibilityLabel="Company logo" resizeMode="contain" style={{ width: 34, height: 34 }} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={fs.xs} muted>
              {greeting()}
            </Txt>
            <Txt weight="bold" color={c.ink} numberOfLines={1}>
              {data ? `${data.route.code} · ${titleCase(data.route.name)}` : ' '}
            </Txt>
          </View>
        </View>
        <IconButton name="refresh" label="Refresh" filled onPress={refresh} />
        <IconButton name="user" label="Profile" filled onPress={() => router.push('/profile')} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: sp[4], paddingBottom: sp[6] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
      >
        {/* Hero */}
        <View style={{ backgroundColor: isDark ? HERO.dark : HERO.light, borderRadius: radius.xl, padding: sp[5], overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -40, top: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <View style={{ position: 'absolute', left: -60, bottom: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(41,140,214,0.18)' }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt size={fs.sm} weight="semibold" color="rgba(255,255,255,0.85)">
              Today&apos;s collection
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, height: 26, borderRadius: 13 }}>
              <Icon name="route" size={14} color="#fff" />
              <Txt size={fs.xs} weight="semibold" color="#fff">
                {data?.route.code ?? '—'}
              </Txt>
            </View>
          </View>
          {loading ? (
            <Skeleton width="60%" height={36} style={{ marginTop: 10, opacity: 0.3 }} />
          ) : (
            <Txt size={34} weight="bold" color="#fff" num style={{ marginTop: 6, letterSpacing: -0.5 }}>
              {inr(data?.today.total)}
            </Txt>
          )}
          <Txt size={fs.sm} color="rgba(255,255,255,0.8)" num>
            of {inr(data?.today.target)} due this month · {pct}%
          </Txt>
          <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, marginTop: sp[3], overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.accent, borderRadius: 4 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: sp[4], marginTop: sp[3], flexWrap: 'wrap' }}>
            <Txt size={fs.xs} color="rgba(255,255,255,0.85)">
              <Txt size={fs.xs} weight="bold" color="#fff">
                {data?.today.receipts ?? 0}
              </Txt>{' '}
              receipts
            </Txt>
            <Txt size={fs.xs} color="rgba(255,255,255,0.85)">
              <Txt size={fs.xs} weight="bold" color="#fff">
                {data?.counts.members ?? 0}
              </Txt>{' '}
              members
            </Txt>
            <Txt size={fs.xs} color="rgba(255,255,255,0.85)">{dLong(data?.date)}</Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: sp[3], marginTop: sp[4] }}>
            <HeroButton primary icon="plus" label="Collect" onPress={() => toCustomers('due')} />
            <HeroButton icon="receipt" label="Day statement" onPress={() => router.push('/statement')} />
          </View>
        </View>

        <SectionHeader title="Overview" link="All customers" onLink={() => toCustomers('all')} />
        <OverviewGrid data={data} onFilter={toCustomers} />

        <SectionHeader title="Quick actions" />
        <View style={{ flexDirection: 'row', gap: sp[3] }}>
          <QuickAction icon="plus" label="Collect" onPress={() => toCustomers('due')} />
          <QuickAction icon="records" label="Records" onPress={() => router.navigate('/records')} />
          <QuickAction icon="receipt" label="Statement" onPress={() => router.push('/statement')} />
          <QuickAction icon="coins" label="Denomination" onPress={() => setDenomOpen(true)} dot={!!data && !data.denomination.counted && data.denomination.cash > 0} />
        </View>

        <SectionHeader title="Recent collections" link="See all" onLink={() => router.push('/statement')} />
        {data && data.recent.length === 0 ? (
          <Card pad>
            <Txt size={fs.sm} muted align="center">
              No collections yet today. Tap Collect to record the first one.
            </Txt>
          </Card>
        ) : (
          <ListGroup>
            {(data?.recent ?? []).map((r) => (
              <ListRow
                key={r.id}
                onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: String(r.id) } })}
                lead={<Avatar name={r.name} size="sm" />}
                title={titleCase(r.name)}
                sub={`${r.group} / ${r.ticketNo ?? '—'} · ${timeOf(r.createdAt)}`}
                end={<RowEnd amount={inr(r.amount)} caption={MODE_LABEL[r.mode]} />}
              />
            ))}
          </ListGroup>
        )}
      </ScrollView>

      <DenominationSheet visible={denomOpen} onClose={() => setDenomOpen(false)} />
    </View>
  )
}

function HeroButton({ icon, label, onPress, primary }: { icon: IconName; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 44,
        borderRadius: radius.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: primary ? '#fff' : 'rgba(255,255,255,0.16)',
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Icon name={icon} size={18} color={primary ? HERO.light : '#fff'} strokeWidth={2.1} />
      <Txt size={fs.sm} weight="bold" color={primary ? HERO.light : '#fff'}>
        {label}
      </Txt>
    </Pressable>
  )
}

function QuickAction({ icon, label, onPress, dot }: { icon: IconName; label: string; onPress: () => void; dot?: boolean }) {
  const { c } = useTheme()
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, transform: [{ scale: pressed ? 0.96 : 1 }] })}>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.divider, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={c.primary} />
        {dot && <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger }} />}
      </View>
      <Txt size={12} weight="semibold" numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  )
}

type Tile = { label: string; value: string; icon: IconName; tone: Tone; onPress?: () => void; alert?: boolean }

/**
 * The route at a glance as a grid of small tiles, four to a row: a tinted icon,
 * the figure and a short label. Member tiles open Customers filtered to them.
 */
function OverviewGrid({ data, onFilter }: { data: Overview | undefined; onFilter: (filter: string) => void }) {
  const { c } = useTheme()
  const n = (v: number | undefined) => (data ? String(v ?? 0) : '—')
  const amt = (v: number | undefined) => (data ? inrShort(v ?? 0) : '—')

  const tiles: Tile[] = [
    { label: 'Members', value: n(data?.counts.members), icon: 'users', tone: 'info', onPress: () => onFilter('all') },
    { label: 'Up to date', value: n(data?.counts.paid), icon: 'checkCircle', tone: 'success', onPress: () => onFilter('paid') },
    { label: 'Due', value: n(data?.counts.due), icon: 'calendar', tone: 'warning', onPress: () => onFilter('due') },
    { label: 'Overdue', value: n(data?.counts.overdue), icon: 'alert', tone: 'danger', onPress: () => onFilter('overdue'), alert: !!data?.counts.overdue },
    { label: 'Arrears', value: amt(data?.arrears.amount), icon: 'clock', tone: 'danger', onPress: () => onFilter('overdue') },
    { label: 'Prized', value: n(data?.counts.prized), icon: 'trophy', tone: 'violet', onPress: () => onFilter('prized') },
    { label: 'Cash today', value: amt(data?.today.cash), icon: 'cash', tone: 'success' },
    { label: 'Online / Chq', value: amt((data?.today.online ?? 0) + (data?.today.cheque ?? 0)), icon: 'upi', tone: 'primary' },
  ]

  return (
    <Card style={{ paddingVertical: sp[2] }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {tiles.map((t) => {
          const tc = toneColors(c, t.tone)
          return (
            <Press key={t.label} onPress={t.onPress} disabled={!t.onPress} style={{ width: '25%', alignItems: 'center', paddingVertical: sp[3], paddingHorizontal: 4, gap: 6 }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: tc.bg }}>
                <Icon name={t.icon} size={22} color={tc.fg} />
                {t.alert && <View style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: c.danger, borderWidth: 2, borderColor: c.surface }} />}
              </View>
              <Txt weight="bold" num color={c.ink} numberOfLines={1} adjustsFontSizeToFit>
                {t.value}
              </Txt>
              <Txt size={11} muted align="center" numberOfLines={1}>
                {t.label}
              </Txt>
            </Press>
          )
        })}
      </View>
    </Card>
  )
}
