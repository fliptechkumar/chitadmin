import { router, useLocalSearchParams } from 'expo-router'
import { RefreshControl, ScrollView, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import type { GroupDetail } from '@/api/types'
import { useApi } from '@/api/useApi'
import {
  AppBar,
  Avatar,
  Bold,
  Card,
  ErrorState,
  InlineAlert,
  ListGroup,
  ListRow,
  RowEnd,
  SectionHeader,
  SkeletonCards,
  StatusPill,
  Txt,
} from '@/components/ui'
import { dLong, inr, MONTHS, monthLabel, titleCase } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs, sp } from '@/theme/tokens'

export default function GroupScreen() {
  const { c } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: g, error, loading, refreshing, refresh } = useApi<GroupDetail>(`/api/v1/route/groups/${id}`)

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title={g?.code ?? 'Group'} sub={g ? `${inr(g.value)} chit · ${g.months} months` : undefined} back />
      {error && !g ? (
        <ErrorState message={error.message} onRetry={refresh} />
      ) : loading || !g ? (
        <View style={{ padding: sp[4] }}>
          <SkeletonCards n={3} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: sp[4], paddingBottom: sp[6] }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}>
          <Card pad>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Txt size={fs.sm} muted>
                  Chit value
                </Txt>
                <Txt size={fs['2xl']} weight="bold" num color={c.ink}>
                  {inr(g.value)}
                </Txt>
              </View>
              <StatusPill status={g.status} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp[4], marginVertical: sp[4] }}>
              <Svg width={76} height={76} viewBox="0 0 36 36">
                <Circle cx={18} cy={18} r={15.5} fill="none" stroke={c.divider} strokeWidth={3.5} />
                <Circle
                  cx={18}
                  cy={18}
                  r={15.5}
                  fill="none"
                  stroke={c.primary}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeDasharray={`${(g.currentMonth / g.months) * 97.4} 97.4`}
                  transform="rotate(-90 18 18)"
                />
              </Svg>
              <View>
                <Txt size={fs.xl} weight="bold" num color={c.ink}>
                  {g.currentMonth}/{g.months}
                </Txt>
                <Txt size={fs.sm} muted>
                  months done
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {[
                ['Monthly (now)', inr(g.monthlyDue)],
                ['Members', `${g.seats} of ${g.months}`],
                ['Started', monthLabel(g.startDate)],
                ['Ends', monthLabel(g.endDate)],
              ].map(([k, v]) => (
                <View key={k} style={{ width: '50%', paddingBottom: sp[3] }}>
                  <Txt size={fs.xs} muted>
                    {k}
                  </Txt>
                  <Txt size={fs.sm} weight="bold" color={c.ink} style={{ marginTop: 2 }}>
                    {v}
                  </Txt>
                </View>
              ))}
            </View>
          </Card>

          {g.nextAuction && (
            <InlineAlert tone="info" icon="gavel" style={{ marginTop: sp[4] }}>
              Next auction <Bold>#{g.nextAuction.installmentNo}</Bold> on <Bold>{dLong(g.nextAuction.date)}</Bold>
            </InlineAlert>
          )}

          <SectionHeader title="Auction history" />
          {g.auctions.length ? (
            <ListGroup>
              {g.auctions.map((a) => {
                const d = new Date(a.date)
                return (
                  <ListRow
                    key={a.installmentNo}
                    lead={
                      <View style={{ width: 44, alignItems: 'center', paddingVertical: 4, borderRadius: 10, backgroundColor: c.surface2 }}>
                        <Txt size={fs.sm} weight="bold" color={c.ink}>
                          #{a.installmentNo}
                        </Txt>
                        <Txt size={10} muted>
                          {MONTHS[d.getMonth()]}
                        </Txt>
                      </View>
                    }
                    title={`Discount ${inr(a.discount)}`}
                    sub={`${dLong(a.date)} · Dividend ${inr(a.dividend)}`}
                    end={<RowEnd amount={inr(a.prize)} caption="Prize paid" />}
                  />
                )
              })}
            </ListGroup>
          ) : (
            <Card pad>
              <Txt size={fs.sm} muted align="center">
                No auctions held yet.
              </Txt>
            </Card>
          )}

          <SectionHeader title={`Members on your route (${g.members.length})`} />
          <ListGroup>
            {g.members.map((m) => (
              <ListRow
                key={m.ticketId}
                onPress={() => router.push({ pathname: '/member/[id]', params: { id: String(m.ticketId) } })}
                lead={<Avatar name={m.name} size="sm" />}
                title={titleCase(m.name)}
                sub={`Ticket ${m.ticketNo}${m.area ? ` · ${titleCase(m.area)}` : ''}`}
                end={<StatusPill status={m.status} />}
                chevron
              />
            ))}
          </ListGroup>
        </ScrollView>
      )}
    </View>
  )
}
