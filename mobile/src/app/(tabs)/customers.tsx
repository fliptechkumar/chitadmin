import { useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { FlatList, RefreshControl, ScrollView, View } from 'react-native'

import type { Member } from '@/api/types'
import { useApi } from '@/api/useApi'
import { useOverlay } from '@/components/overlays'
import { Button, Chip, EmptyState, ErrorState, IconButton, LargeHeader, SearchBar, SkeletonCards, Txt } from '@/components/ui'
import { CollectSheet } from '@/features/CollectSheet'
import { MemberCard } from '@/features/MemberCard'
import { inr } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs, sp } from '@/theme/tokens'

type Filter = 'all' | 'due' | 'overdue' | 'paid' | 'prized'
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['due', 'Due'],
  ['overdue', 'Overdue'],
  ['paid', 'Up to date'],
  ['prized', 'Prized'],
]

const matches = (m: Member, f: Filter) => f === 'all' || (f === 'prized' ? m.isPrized : m.status === f)

export default function Customers() {
  const { c } = useTheme()
  const { pick } = useOverlay()
  const params = useLocalSearchParams<{ filter?: string }>()
  const { data, error, loading, refreshing, refresh } = useApi<Member[]>('/api/v1/route/members')

  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [group, setGroup] = useState<string>('all')
  const [collecting, setCollecting] = useState<Member | null>(null)

  // Home's tiles open this tab with a filter.
  const [appliedParam, setAppliedParam] = useState<string | undefined>(undefined)
  if (params.filter !== appliedParam) {
    setAppliedParam(params.filter)
    const f = params.filter as Filter | undefined
    if (f && FILTERS.some(([k]) => k === f)) {
      setFilter(f)
      setGroup('all')
      setQ('')
    }
  }

  const members = useMemo(() => data ?? [], [data])
  const inGroup = useMemo(() => (group === 'all' ? members : members.filter((m) => m.group === group)), [members, group])
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, inGroup.filter((m) => matches(m, k)).length])), [inGroup])

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return inGroup.filter(
      (m) => matches(m, filter) && (!ql || `${m.name} ${m.mobile} ${m.accountNo} ${m.area} ${m.group} ${m.ticketNo}`.toLowerCase().includes(ql)),
    )
  }, [inGroup, filter, q])

  const groups = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of members) map.set(m.group, (map.get(m.group) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
  }, [members])

  async function pickGroup() {
    const v = await pick({
      title: 'Filter by group',
      value: group,
      searchable: true,
      options: [{ value: 'all', label: 'All groups', sub: `${groups.length} groups` }, ...groups.map(([g, n]) => ({ value: g, label: g, sub: `${n} member${n === 1 ? '' : 's'} on your route` }))],
    })
    if (v) setGroup(v)
  }

  const onCollect = useCallback((m: Member) => setCollecting(m), [])
  const clear = () => {
    setQ('')
    setFilter('all')
    setGroup('all')
  }

  const header = (
    <View>
      <SearchBar value={q} onChangeText={setQ} placeholder="Search name, mobile, account or area" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -sp[4], marginTop: sp[3] }} contentContainerStyle={{ gap: sp[2], paddingHorizontal: sp[4], paddingVertical: 2 }}>
        <Chip icon="layers" label={group === 'all' ? 'All groups' : group} active={group !== 'all'} trailing="chevD" onPress={pickGroup} />
        {FILTERS.map(([k, l]) => (
          <Chip key={k} label={l} count={counts[k]} active={filter === k} onPress={() => setFilter(k)} />
        ))}
      </ScrollView>
      {data && list.length > 0 && (
        <Txt size={fs.xs} weight="semibold" muted style={{ marginTop: sp[4], marginBottom: sp[2] }}>
          {list.length} of {members.length} members · {inr(list.reduce((s, m) => s + m.outstanding, 0))} pending
        </Txt>
      )}
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LargeHeader
        title="Customers"
        sub={data ? `${members.length} members on your route` : 'Loading…'}
        actions={<IconButton name="refresh" label="Refresh" filled onPress={refresh} />}
      />
      {error && !data ? (
        <ErrorState message={error.message} onRetry={refresh} />
      ) : (
        <FlatList
          data={loading ? [] : list}
          keyExtractor={(m) => String(m.ticketId)}
          renderItem={({ item }) => <MemberCard m={item} onCollect={onCollect} />}
          ListHeaderComponent={header}
          ListHeaderComponentStyle={{ marginBottom: loading ? sp[4] : 0 }}
          ListEmptyComponent={
            loading ? (
              <SkeletonCards n={4} />
            ) : (
              <EmptyState
                icon="search"
                title="No customers found"
                text={q ? `Nothing matches “${q}”. Try a name, mobile number or account number.` : 'No customers match these filters.'}
                action={<Button small variant="outline" title="Clear filters" onPress={clear} />}
              />
            )
          }
          contentContainerStyle={{ paddingHorizontal: sp[4], paddingTop: 4, paddingBottom: sp[6] }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={8}
          windowSize={7}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
        />
      )}
      <CollectSheet member={collecting} visible={!!collecting} onClose={() => setCollecting(null)} />
    </View>
  )
}
