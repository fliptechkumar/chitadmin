import { router } from 'expo-router'
import { useState } from 'react'
import { Image, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { Overview } from '@/api/types'
import { useApi } from '@/api/useApi'
import { Icon, type IconName } from '@/components/Icon'
import {
  Avatar,
  Card,
  ErrorState,
  IconButton,
  ListGroup,
  ListRow,
  RowEnd,
  RowIcon,
  SectionHeader,
  Skeleton,
  StatTile,
  Txt,
} from '@/components/ui'
import { DenominationSheet } from '@/features/DenominationSheet'
import { dLong, greeting, inr, MODE_LABEL, timeOf, titleCase } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs, radius, shadow, sp } from '@/theme/tokens'

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
        <View style={{ backgroundColor: c.primary, borderRadius: radius.xl, padding: sp[5], overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -40, top: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)' }} />
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
        <View style={{ gap: sp[3] }}>
          <View style={{ flexDirection: 'row', gap: sp[3] }}>
            <StatTile n={data?.counts.members ?? '—'} label="Total members" icon="users" tone="info" onPress={() => toCustomers('all')} />
            <StatTile n={data?.counts.paid ?? '—'} label="Up to date" icon="checkCircle" tone="success" onPress={() => toCustomers('paid')} />
          </View>
          <View style={{ flexDirection: 'row', gap: sp[3] }}>
            <StatTile n={data?.counts.due ?? '—'} label="Due this month" icon="calendar" tone="warning" onPress={() => toCustomers('due')} />
            <StatTile n={data?.counts.overdue ?? '—'} label="Overdue" icon="alert" tone="danger" onPress={() => toCustomers('overdue')} />
          </View>
        </View>

        <Card onPress={() => toCustomers('overdue')} style={{ marginTop: sp[3] }}>
          <ListRow
            lead={<RowIcon name="clock" tone="danger" />}
            title="Total arrears"
            sub={`${data?.arrears.accounts ?? 0} accounts on your route`}
            end={<RowEnd amount={inr(data?.arrears.amount)} color={c.danger} />}
            chevron
          />
        </Card>

        <Card pad style={{ marginTop: sp[3], flexDirection: 'row' }}>
          {[
            ['Prized', String(data?.counts.prized ?? 0)],
            ['Cash today', inr(data?.today.cash)],
            ['Online today', inr((data?.today.online ?? 0) + (data?.today.cheque ?? 0))],
          ].map(([k, v], i) => (
            <View key={k} style={{ flex: 1, paddingLeft: i ? sp[3] : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.divider }}>
              <Txt size={fs.xs} muted>
                {k}
              </Txt>
              <Txt weight="bold" num color={c.ink} style={{ marginTop: 3 }} numberOfLines={1} adjustsFontSizeToFit>
                {v}
              </Txt>
            </View>
          ))}
        </Card>

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
  const { c } = useTheme()
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
      <Icon name={icon} size={18} color={primary ? c.primary : '#fff'} strokeWidth={2.1} />
      <Txt size={fs.sm} weight="bold" color={primary ? c.primary : '#fff'}>
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
