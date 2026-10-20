import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'

import type { MemberDetail } from '@/api/types'
import { useApi } from '@/api/useApi'
import { Icon, type IconName } from '@/components/Icon'
import {
  AppBar,
  Avatar,
  Button,
  Card,
  ErrorState,
  IconButton,
  ListGroup,
  ListRow,
  Pill,
  ProgressBar,
  RowEnd,
  RowIcon,
  SectionHeader,
  SkeletonCards,
  StatusPill,
  StickyFooter,
  Txt,
} from '@/components/ui'
import { CollectSheet } from '@/features/CollectSheet'
import { callNumber } from '@/features/MemberCard'
import { MonthRow } from '@/features/MonthRow'
import { dLong, dShort, inr, MODE_LABEL, titleCase } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs, sp } from '@/theme/tokens'

export default function MemberScreen() {
  const { c } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, error, loading, refreshing, refresh } = useApi<MemberDetail>(`/api/v1/route/members/${id}`)
  const [collect, setCollect] = useState(false)

  const m = data?.member
  // Months up to now, newest first: what the agent is asked about at the door.
  const recent = (data?.records ?? []).filter((r) => r.status !== 'upcoming').slice(-4).reverse()
  const paidMonths = (data?.records ?? []).filter((r) => r.amountPaid >= r.amountDue && r.amountDue > 0).length
  const last = data?.receipts[0]

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Customer" back actions={m?.mobile ? <IconButton name="phone" label="Call" onPress={() => callNumber(m.mobile)} /> : null} />
      {error && !data ? (
        <ErrorState message={error.message} onRetry={refresh} />
      ) : loading || !m ? (
        <View style={{ padding: sp[4] }}>
          <SkeletonCards n={3} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: sp[4], paddingBottom: sp[6] }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}>
            <Card pad>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <Avatar name={m.name} size="lg" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={fs.lg} weight="bold" color={c.ink}>
                    {titleCase(m.name)}
                  </Txt>
                  <Txt size={fs.sm} muted style={{ marginTop: 2 }}>
                    #{m.accountNo} · {m.branch}
                  </Txt>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <StatusPill status={m.status} />
                    {m.isPrized && <Pill tone="violet" label="Prized" dot={false} />}
                  </View>
                </View>
              </View>
              <View style={{ marginTop: sp[4], gap: 10, paddingTop: sp[4], borderTopWidth: 1, borderTopColor: c.divider }}>
                <InfoLine icon="layers" text={`${m.group} · Ticket ${m.ticketNo}`} />
                {m.mobile ? <InfoLine icon="phone" text={m.mobile} /> : null}
                {m.address ? <InfoLine icon="pin" text={m.address} /> : null}
                {m.introducer ? <InfoLine icon="userPlus" text={`Introducer: ${titleCase(m.introducer)}`} /> : null}
              </View>
            </Card>

            <Card style={{ marginTop: sp[4] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: sp[4] }}>
                <View>
                  <Txt size={fs.sm} muted>
                    {m.outstanding ? 'Amount due' : 'Nothing due'}
                  </Txt>
                  <Txt size={fs['3xl']} weight="bold" num color={m.outstanding ? c.danger : c.success} style={{ marginTop: 2 }}>
                    {inr(m.outstanding)}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt size={fs.sm} muted>
                    Chit value
                  </Txt>
                  <Txt size={fs.lg} weight="bold" num color={c.ink} style={{ marginTop: 4 }}>
                    {inr(m.chitValue)}
                  </Txt>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: sp[4] }}>
                {[
                  ['Oldest unpaid', m.outstanding ? dLong(m.nextDueDate) : '—'],
                  ['Current inst.', `${m.currentInstallment} of ${m.months}`],
                  ['This month', inr(m.monthlyDue)],
                  ['Paid so far', inr(m.paidToDate)],
                ].map(([k, v]) => (
                  <View key={k} style={{ width: '50%', paddingBottom: sp[3] }}>
                    <Txt size={fs.xs} muted>
                      {k}
                    </Txt>
                    <Txt size={fs.sm} weight="bold" num color={c.ink} style={{ marginTop: 2 }}>
                      {v}
                    </Txt>
                  </View>
                ))}
              </View>
              <View style={{ paddingHorizontal: sp[4], paddingBottom: sp[4] }}>
                <ProgressBar value={paidMonths / m.months} small />
                <Txt size={fs.xs} muted style={{ marginTop: 6 }}>
                  {paidMonths} of {m.months} months fully paid
                </Txt>
              </View>
            </Card>

            {m.isPrized && (
              <Card style={{ marginTop: sp[4] }}>
                <ListRow
                  lead={<RowIcon name="trophy" tone="violet" />}
                  title={data.prize ? `Prized in auction #${data.prize.installmentNo}` : 'Prized'}
                  sub={data.prize ? `${dLong(data.prize.date)} · prize amount` : 'Has already taken the chit amount'}
                  end={data.prize ? <RowEnd amount={inr(data.prize.amount)} /> : undefined}
                />
              </Card>
            )}

            <SectionHeader
              title="Recent instalments"
              link="All records"
              onLink={() => router.navigate({ pathname: '/records', params: { group: String(m.groupId), ticket: String(m.ticketId) } })}
            />
            <ListGroup>{recent.map((r) => <MonthRow key={r.installmentNo} r={r} />)}</ListGroup>

            {data.receipts.length > 0 && (
              <>
                <SectionHeader title="Recent payments" />
                <ListGroup>
                  {data.receipts.slice(0, 5).map((r) => (
                    <ListRow
                      key={r.id}
                      onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: String(r.id) } })}
                      lead={<RowIcon name="receipt" tone="primary" />}
                      title={r.receiptNo}
                      sub={`${dShort(r.date)} · ${MODE_LABEL[r.mode]}`}
                      end={<RowEnd amount={inr(r.amount)} />}
                      chevron
                    />
                  ))}
                </ListGroup>
              </>
            )}
          </ScrollView>
          <StickyFooter>
            <View style={{ flexDirection: 'row', gap: sp[3] }}>
              <Button
                variant="outline"
                icon="receipt"
                title="Last receipt"
                disabled={!last}
                onPress={() => last && router.push({ pathname: '/receipt/[id]', params: { id: String(last.id) } })}
                style={{ flex: 1 }}
              />
              <Button icon="wallet" title={m.outstanding ? `Collect ${inr(m.currentDue || m.outstanding)}` : 'Advance'} variant={m.outstanding ? 'primary' : 'secondary'} onPress={() => setCollect(true)} style={{ flex: 1.3 }} />
            </View>
          </StickyFooter>
          <CollectSheet member={m} visible={collect} onClose={() => setCollect(false)} />
        </>
      )}
    </View>
  )
}

function InfoLine({ icon, text }: { icon: IconName; text: string }) {
  const { c } = useTheme()
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ marginTop: 1 }}>
        <Icon name={icon} size={16} color={c.muted} />
      </View>
      <Txt size={fs.sm} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  )
}
