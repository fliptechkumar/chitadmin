import { router } from 'expo-router'
import { useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'

import type { Overview, Report } from '@/api/types'
import { useApi } from '@/api/useApi'
import { Card, ErrorState, LargeHeader, ListGroup, ListRow, ProgressBar, RowEnd, RowIcon, SectionHeader, Segmented, Skeleton, StatTile, Txt } from '@/components/ui'
import { DenominationSheet } from '@/features/DenominationSheet'
import { inr, inrShort, toDate } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs, radius, sp } from '@/theme/tokens'

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
type Period = Report['period']

export default function Reports() {
  const { c } = useTheme()
  const [period, setPeriod] = useState<Period>('today')
  const { data, error, loading, refreshing, refresh } = useApi<Report>(`/api/v1/route/report?period=${period}`)
  const overview = useApi<Overview>('/api/v1/route/overview')
  const [denomOpen, setDenomOpen] = useState(false)

  const t = data?.totals
  const max = Math.max(1, ...(data?.lastSevenDays ?? []).map((d) => d.amount))
  const modes = [
    { label: 'Cash', value: t?.cash ?? 0, color: c.primary },
    { label: 'Online', value: t?.online ?? 0, color: c.info },
    { label: 'Cheque', value: t?.cheque ?? 0, color: c.accent },
  ]
  const modeTotal = modes.reduce((s, m) => s + m.value, 0)
  const ov = overview.data

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LargeHeader title="Reports" sub={ov ? `${ov.route.branch} · ${ov.route.code} ${ov.route.name}` : 'Your route'} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: sp[4], paddingTop: 4, paddingBottom: sp[6] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
      >
        <Segmented
          value={period}
          onChange={setPeriod}
          style={{ marginBottom: sp[4] }}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Last 7 days' },
            { value: 'month', label: 'This month' },
          ]}
        />

        {error && !data ? (
          <ErrorState message={error.message} onRetry={refresh} />
        ) : (
          <>
            <Card pad>
              <Txt size={fs.sm} muted>
                Collected
              </Txt>
              {loading ? (
                <Skeleton width="55%" height={34} style={{ marginTop: 6 }} />
              ) : (
                <Txt size={fs['3xl']} weight="bold" num color={c.ink} style={{ marginTop: 2 }}>
                  {inr(t?.total)}
                </Txt>
              )}
              {period === 'today' && ov ? (
                <>
                  <View style={{ marginTop: sp[3], marginBottom: sp[2] }}>
                    <ProgressBar value={ov.today.target ? ov.today.total / ov.today.target : 0} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt size={12} muted>
                      Due this month {inr(ov.today.target)}
                    </Txt>
                    <Txt size={12} muted>
                      Arrears {inr(ov.arrears.amount)}
                    </Txt>
                  </View>
                </>
              ) : null}
            </Card>

            <View style={{ flexDirection: 'row', gap: sp[3], marginTop: sp[3] }}>
              <StatTile label="Receipts" n={t?.receipts ?? 0} />
              <StatTile label="Avg receipt" n={t?.receipts ? inrShort(Math.round(t.total / t.receipts)) : '—'} />
              <StatTile label="Cash share" n={t?.total ? `${Math.round((t.cash / t.total) * 100)}%` : '—'} />
            </View>

            <SectionHeader title="Last 7 days" />
            <Card pad>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 150 }}>
                {(data?.lastSevenDays ?? []).map((d, i, all) => {
                  const today = i === all.length - 1
                  const date = toDate(d.date)
                  return (
                    <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 6, height: '100%' }}>
                      <Txt size={10} weight="semibold" muted num numberOfLines={1}>
                        {d.amount ? inrShort(d.amount) : '–'}
                      </Txt>
                      <View style={{ flex: 1, width: '100%', maxWidth: 28, justifyContent: 'flex-end', backgroundColor: c.surface2, borderRadius: 6 }}>
                        <View style={{ height: `${d.amount ? Math.max(4, (d.amount / max) * 100) : 0}%`, backgroundColor: today ? c.primary : c.primarySoft, borderRadius: 6 }} />
                      </View>
                      <Txt size={11} weight={today ? 'bold' : 'medium'} color={today ? c.primary : c.muted}>
                        {date ? DAY[date.getDay()] : ''}
                      </Txt>
                    </View>
                  )
                })}
              </View>
            </Card>

            <SectionHeader title="Payment modes" />
            <Card pad>
              <View style={{ flexDirection: 'row', height: 12, borderRadius: radius.full, overflow: 'hidden', backgroundColor: c.divider }}>
                {modeTotal > 0 && modes.map((m) => <View key={m.label} style={{ width: `${(m.value / modeTotal) * 100}%`, backgroundColor: m.color }} />)}
              </View>
              <View style={{ marginTop: sp[3], gap: 10 }}>
                {modes.map((m) => (
                  <View key={m.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: m.color }} />
                    <Txt size={fs.sm} style={{ flex: 1 }}>
                      {m.label}
                    </Txt>
                    <Txt size={fs.sm} weight="bold" num color={c.ink}>
                      {inr(m.value)}
                    </Txt>
                    <Txt size={fs.sm} muted num style={{ width: 40, textAlign: 'right' }}>
                      {modeTotal ? Math.round((m.value / modeTotal) * 100) : 0}%
                    </Txt>
                  </View>
                ))}
              </View>
            </Card>

            <SectionHeader title="Group-wise collection" />
            {data?.groups.length ? (
              <ListGroup>
                {data.groups.slice(0, 10).map((g) => (
                  <ListRow
                    key={g.group}
                    title={g.group}
                    sub={
                      <View style={{ marginTop: 8 }}>
                        <ProgressBar value={t?.total ? g.amount / t.total : 0} small />
                      </View>
                    }
                    end={<RowEnd amount={inr(g.amount)} caption={`${g.receipts} receipt${g.receipts === 1 ? '' : 's'}`} />}
                  />
                ))}
              </ListGroup>
            ) : (
              <Card pad>
                <Txt size={fs.sm} muted align="center">
                  No collections in this period.
                </Txt>
              </Card>
            )}

            <SectionHeader title="Day close" />
            <ListGroup>
              <ListRow
                onPress={() => router.push('/statement')}
                lead={<RowIcon name="receipt" tone="primary" />}
                title="Day statement"
                sub={ov ? `${ov.today.receipts} receipts · ${inr(ov.today.total)}` : 'Today'}
                chevron
              />
              <ListRow
                onPress={() => setDenomOpen(true)}
                lead={<RowIcon name="coins" tone="warning" />}
                title="Cash denomination"
                sub={ov ? (ov.denomination.counted ? (ov.denomination.total === ov.denomination.cash ? `Matched · ${inr(ov.denomination.total)}` : `Counted ${inr(ov.denomination.total)} · cash ${inr(ov.denomination.cash)}`) : 'Not entered yet') : ' '}
                chevron
              />
              <ListRow
                onPress={() => router.navigate({ pathname: '/customers', params: { filter: 'overdue' } })}
                lead={<RowIcon name="alert" tone="danger" />}
                title="Arrears list"
                sub={ov ? `${ov.counts.overdue} overdue customers` : ' '}
                chevron
              />
            </ListGroup>
          </>
        )}
      </ScrollView>
      <DenominationSheet visible={denomOpen} onClose={() => setDenomOpen(false)} />
    </View>
  )
}
