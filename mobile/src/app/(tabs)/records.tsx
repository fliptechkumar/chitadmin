import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'

import type { Member, MemberDetail } from '@/api/types'
import { useApi } from '@/api/useApi'
import { Icon } from '@/components/Icon'
import { useOverlay } from '@/components/overlays'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  LargeHeader,
  ListGroup,
  ProgressBar,
  Segmented,
  SelectField,
  SkeletonCards,
  Txt,
} from '@/components/ui'
import { CollectSheet } from '@/features/CollectSheet'
import { MonthRow } from '@/features/MonthRow'
import { inr, titleCase } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs, sp } from '@/theme/tokens'

type Filter = 'all' | 'paid' | 'pending'

export default function Records() {
  const { c } = useTheme()
  const { pick } = useOverlay()
  const params = useLocalSearchParams<{ group?: string; ticket?: string }>()
  const members = useApi<Member[]>('/api/v1/route/members')

  const [groupId, setGroupId] = useState<number | null>(null)
  const [ticketId, setTicketId] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [collect, setCollect] = useState(false)

  // "All records" on a member's page opens this tab on that member.
  const paramKey = `${params.group ?? ''}|${params.ticket ?? ''}`
  const [appliedKey, setAppliedKey] = useState('|')
  if (paramKey !== appliedKey) {
    setAppliedKey(paramKey)
    if (params.group) setGroupId(Number(params.group))
    if (params.ticket) {
      setTicketId(Number(params.ticket))
      setFilter('all')
    }
  }

  const detail = useApi<MemberDetail>(ticketId ? `/api/v1/route/members/${ticketId}` : null)

  const groups = useMemo(() => {
    const map = new Map<number, { code: string; value: number; count: number }>()
    for (const m of members.data ?? []) {
      const g = map.get(m.groupId) ?? { code: m.group, value: m.chitValue, count: 0 }
      g.count += 1
      map.set(m.groupId, g)
    }
    return [...map.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code, undefined, { numeric: true }))
  }, [members.data])

  const group = groups.find(([id]) => id === groupId)?.[1]
  const inGroup = useMemo(() => (members.data ?? []).filter((m) => m.groupId === groupId), [members.data, groupId])
  const seat = inGroup.find((m) => m.ticketId === ticketId)

  async function pickGroup() {
    const v = await pick({
      title: 'Select group',
      value: groupId ? String(groupId) : null,
      searchable: true,
      options: groups.map(([id, g]) => ({ value: String(id), label: g.code, sub: `${inr(g.value)} · ${g.count} on your route` })),
    })
    if (v && Number(v) !== groupId) {
      setGroupId(Number(v))
      setTicketId(null)
    }
  }

  async function pickMember() {
    if (!groupId) return
    const v = await pick({
      title: `Customers in ${group?.code ?? ''}`,
      value: ticketId ? String(ticketId) : null,
      searchable: true,
      options: inGroup.map((m) => ({
        value: String(m.ticketId),
        label: titleCase(m.name),
        sub: `Ticket ${m.ticketNo} · #${m.accountNo}${m.area ? ` · ${titleCase(m.area)}` : ''}`,
        lead: <Avatar name={m.name} size="sm" />,
      })),
    })
    if (v) {
      setTicketId(Number(v))
      setFilter('all')
    }
  }

  const d = detail.data
  const m = d?.member
  const months = (d?.records ?? [])
    .filter((r) => r.status !== 'upcoming' || r.amountPaid > 0)
    .filter((r) => filter === 'all' || (filter === 'paid' ? r.amountPaid >= r.amountDue : r.amountPaid < r.amountDue))
    .reverse()
  const paidMonths = (d?.records ?? []).filter((r) => r.amountPaid >= r.amountDue && r.amountDue > 0).length

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LargeHeader title="Collection Records" sub="Month-wise instalments by customer" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: sp[4], paddingTop: 4, paddingBottom: sp[6] }}
        refreshControl={<RefreshControl refreshing={detail.refreshing || members.refreshing} onRefresh={() => (ticketId ? detail.refresh() : members.refresh())} tintColor={c.primary} colors={[c.primary]} />}
      >
        <SelectField label="Group" icon="layers" value={group ? `${group.code} · ${inr(group.value)}` : ''} placeholder={members.data ? 'Select group' : 'Loading…'} onPress={pickGroup} />
        <SelectField label="Customer" icon="user" value={seat ? `${titleCase(seat.name)} · T${seat.ticketNo}` : ''} placeholder={groupId ? 'Select customer' : 'Select a group first'} onPress={pickMember} />

        {!ticketId ? (
          <EmptyState icon="records" title="Select a customer" text={groupId ? `Pick a customer from ${group?.code} to see their monthly records.` : 'Choose a group and then a customer to see month-wise collection records.'} />
        ) : detail.loading || !m ? (
          <View style={{ marginTop: sp[2] }}>
            <SkeletonCards n={2} />
          </View>
        ) : (
          <>
            <Card pad style={{ marginTop: sp[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp[3] }}>
                <Avatar name={m.name} size="sm" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="semibold" color={c.ink} numberOfLines={1}>
                    {titleCase(m.name)}
                  </Txt>
                  <Txt size={fs.sm} muted numberOfLines={1}>
                    {m.group} · Ticket {m.ticketNo}
                  </Txt>
                </View>
                <Button small variant="secondary" title="Profile" onPress={() => router.push({ pathname: '/member/[id]', params: { id: String(m.ticketId) } })} />
              </View>
              <View style={{ flexDirection: 'row', marginVertical: sp[4] }}>
                {[
                  ['Paid', inr(m.paidToDate), c.success],
                  ['Pending', inr(m.outstanding), m.outstanding ? c.danger : c.ink],
                  ['Months paid', `${paidMonths}/${m.months}`, c.ink],
                ].map(([k, v, col], i) => (
                  <View key={k} style={{ flex: 1, paddingLeft: i ? sp[3] : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.divider }}>
                    <Txt size={fs.xs} muted>
                      {k}
                    </Txt>
                    <Txt weight="bold" num color={col} style={{ marginTop: 2 }}>
                      {v}
                    </Txt>
                  </View>
                ))}
              </View>
              <ProgressBar value={paidMonths / m.months} small />
            </Card>

            <Segmented
              style={{ marginTop: sp[4], marginBottom: sp[3] }}
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'paid', label: 'Paid' },
                { value: 'pending', label: 'Pending' },
              ]}
            />

            {months.length ? (
              <>
                <ListGroup>
                  {months.map((r) => (
                    <MonthRow key={r.installmentNo} r={r} onPress={r.amountPaid < r.amountDue ? () => setCollect(true) : undefined} />
                  ))}
                </ListGroup>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: sp[3] }}>
                  <Icon name="info" size={13} color={c.subtle} />
                  <Txt size={12} color={c.subtle}>
                    Tap an unpaid month to collect. Corrections are made by the office.
                  </Txt>
                </View>
              </>
            ) : (
              <EmptyState icon="checkCircle" title={filter === 'pending' ? 'No pending instalments' : 'Nothing here yet'} text={filter === 'pending' ? 'This customer is fully up to date.' : 'No months match this filter.'} />
            )}
          </>
        )}
      </ScrollView>
      <CollectSheet member={m ?? null} visible={collect} onClose={() => setCollect(false)} />
    </View>
  )
}
