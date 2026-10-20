import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'

import type { GroupSummary } from '@/api/types'
import { useApi } from '@/api/useApi'
import { Card, EmptyState, ErrorState, LargeHeader, ProgressBar, SearchBar, Segmented, SkeletonCards, StatusPill, Txt } from '@/components/ui'
import { dShort, inr } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs, sp } from '@/theme/tokens'

type Filter = 'active' | 'completed' | 'all'

export default function Groups() {
  const { c } = useTheme()
  const { data, error, loading, refreshing, refresh } = useApi<GroupSummary[]>('/api/v1/route/groups')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('active')

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return (data ?? []).filter((g) => (filter === 'all' || g.status === filter) && (!ql || g.code.toLowerCase().includes(ql) || String(g.value).includes(ql)))
  }, [data, q, filter])
  const active = (data ?? []).filter((g) => g.status === 'active').length

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LargeHeader title="Chit Groups" sub={data ? `${data.length} groups on your route · ${active} active` : 'Loading…'} />
      {error && !data ? (
        <ErrorState message={error.message} onRetry={refresh} />
      ) : (
        <FlatList
          data={loading ? [] : list}
          keyExtractor={(g) => String(g.id)}
          contentContainerStyle={{ paddingHorizontal: sp[4], paddingTop: 4, paddingBottom: sp[6] }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
          ListHeaderComponent={
            <View style={{ marginBottom: sp[4] }}>
              <SearchBar value={q} onChangeText={setQ} placeholder="Search group code or value" />
              <Segmented
                style={{ marginTop: sp[3] }}
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'all', label: 'All' },
                ]}
              />
            </View>
          }
          ListEmptyComponent={loading ? <SkeletonCards n={4} /> : <EmptyState icon="layers" title="No groups found" text="Try another group code or switch the filter." />}
          renderItem={({ item: g }) => (
            <Card onPress={() => router.push({ pathname: '/group/[id]', params: { id: String(g.id) } })} style={{ marginBottom: sp[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp[3], padding: sp[4], paddingBottom: sp[3] }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt size={fs.sm} weight="bold" color={c.primary} numberOfLines={1} adjustsFontSizeToFit style={{ paddingHorizontal: 4 }}>
                    {g.code.replace(/^[A-Z]+/, '') || g.code.slice(0, 3)}
                  </Txt>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt weight="semibold" color={c.ink}>
                    {g.code}
                  </Txt>
                  <Txt size={fs.sm} muted>
                    {inr(g.value)} · {g.months} months
                  </Txt>
                </View>
                <StatusPill status={g.status} />
              </View>
              <View style={{ flexDirection: 'row', marginHorizontal: sp[4], paddingVertical: sp[3], borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.divider }}>
                {[
                  ['Monthly', inr(g.monthlyDue)],
                  ['On your route', `${g.membersOnRoute} of ${g.seats}`],
                  [g.nextAuction ? 'Next auction' : 'Auction', g.nextAuction ? dShort(g.nextAuction.date) : '—'],
                ].map(([k, v], i) => (
                  <View key={k} style={{ flex: 1, paddingLeft: i ? sp[3] : 0 }}>
                    <Txt size={fs.xs} muted>
                      {k}
                    </Txt>
                    <Txt size={fs.sm} weight="bold" num color={c.ink} style={{ marginTop: 2 }} numberOfLines={1}>
                      {v}
                    </Txt>
                  </View>
                ))}
              </View>
              <View style={{ padding: sp[4], paddingTop: sp[3], gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt size={12} muted>
                    Month {g.currentMonth} of {g.months}
                  </Txt>
                  <Txt size={12} muted>
                    {g.paidOnRoute} of {g.membersOnRoute} up to date
                  </Txt>
                </View>
                <ProgressBar value={g.currentMonth / g.months} small />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  )
}
