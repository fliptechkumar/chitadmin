import { router } from 'expo-router'
import { useState } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'

import type { DayStatement, Overview } from '@/api/types'
import { useApi } from '@/api/useApi'
import { Icon } from '@/components/Icon'
import { useOverlay } from '@/components/overlays'
import { AppBar, Bold, Button, Card, EmptyState, ErrorState, IconButton, InlineAlert, ListGroup, ListRow, RowEnd, SectionHeader, SkeletonCards, StickyFooter, Txt } from '@/components/ui'
import { DenominationSheet } from '@/features/DenominationSheet'
import { dLong, inr, MODE_LABEL, timeOf, titleCase } from '@/lib/format'
import { printHtml, shareHtmlAsPdf, statementHtml } from '@/lib/print'
import { useTheme } from '@/theme/theme'
import { fs, radius, sp } from '@/theme/tokens'

export default function Statement() {
  const { c } = useTheme()
  const { confirm, toast } = useOverlay()
  const { data, error, loading, refreshing, refresh } = useApi<DayStatement>('/api/v1/route/collections')
  const overview = useApi<Overview>('/api/v1/route/overview')
  const [denomOpen, setDenomOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const dn = overview.data?.denomination
  const counted = !!dn?.counted
  const matched = counted && dn!.total === dn!.cash

  function html() {
    const ov = overview.data
    return statementHtml(data!, {
      company: ov?.company.name ?? '',
      route: ov ? `${ov.route.code} ${ov.route.name}` : '',
      collector: ov?.collector ?? '',
    })
  }

  async function print() {
    if (!data) return
    if (!counted && data.totals.cash > 0) {
      const go = await confirm({
        title: 'Denomination not entered',
        text: 'Count the cash so it matches the cash collected before printing.',
        ok: 'Count now',
        cancel: 'Print anyway',
        tone: 'warning',
        icon: 'coins',
      })
      // Let the dialog finish closing first; phones drop a modal opened
      // while another is still on screen.
      if (go) return void setTimeout(() => setDenomOpen(true), 350)
    }
    setBusy(true)
    try {
      await printHtml(html())
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg && !/cancel/i.test(msg)) toast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function share() {
    if (!data) return
    try {
      await shareHtmlAsPdf(html(), 'Day statement')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg && !/cancel/i.test(msg)) toast(msg, 'error')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar
        title="Day Statement"
        sub={data ? dLong(data.date) : undefined}
        back
        actions={
          <>
            <IconButton name="refresh" label="Refresh" onPress={() => { refresh(); overview.reload() }} />
            <IconButton name="share" label="Share as PDF" onPress={share} />
          </>
        }
      />
      {error && !data ? (
        <ErrorState message={error.message} onRetry={refresh} />
      ) : loading || !data ? (
        <View style={{ padding: sp[4] }}>
          <SkeletonCards n={3} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: sp[4], paddingBottom: sp[6] }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}>
            <View style={{ flexDirection: 'row', gap: sp[3] }}>
              {[
                ['cash', 'Cash collected', data.totals.cash],
                ['bank', 'Online / Cheque', data.totals.online + data.totals.cheque],
              ].map(([icon, label, amount]) => (
                <Card key={label as string} pad style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name={icon as 'cash' | 'bank'} size={16} color={c.muted} />
                    <Txt size={fs.xs} muted>
                      {label as string}
                    </Txt>
                  </View>
                  <Txt size={fs.xl} weight="bold" num color={c.ink} style={{ marginTop: 6 }}>
                    {inr(amount as number)}
                  </Txt>
                </Card>
              ))}
            </View>

            {data.totals.cash > 0 || counted ? (
              <InlineAlert tone={matched ? 'success' : counted ? 'warning' : 'warning'} icon={matched ? 'checkCircle' : 'clock'} style={{ marginTop: sp[3] }}>
                {matched ? (
                  <>
                    <Bold>Ready to print.</Bold> Denomination matches {inr(dn!.total)}.
                  </>
                ) : counted ? (
                  <>
                    <Bold>Counted {inr(dn!.total)}</Bold> against cash {inr(dn!.cash)} — a reason was recorded.
                  </>
                ) : (
                  <>
                    <Bold>Denomination pending.</Bold> Count the cash before printing.
                  </>
                )}
              </InlineAlert>
            ) : null}

            <SectionHeader title={`Collections (${data.rows.length})`} />
            {data.rows.length === 0 ? (
              <EmptyState icon="receipt" title="No collections yet" text="Receipts you record today appear here." />
            ) : (
              <ListGroup>
                {data.rows.map((r, i) => (
                  <ListRow
                    key={r.id}
                    onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: String(r.id) } })}
                    lead={
                      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
                        <Txt size={12} weight="bold" muted num>
                          {i + 1}
                        </Txt>
                      </View>
                    }
                    title={titleCase(r.name)}
                    sub={`${r.group} / ${r.ticketNo ?? '—'} · ${timeOf(r.createdAt)}`}
                    end={<RowEnd amount={inr(r.amount)} caption={MODE_LABEL[r.mode]} />}
                  />
                ))}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: sp[4], paddingVertical: sp[4], backgroundColor: c.surface2, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg }}>
                  <Txt weight="bold" color={c.ink}>
                    Total
                  </Txt>
                  <Txt weight="bold" num color={c.ink}>
                    {inr(data.totals.total)}
                  </Txt>
                </View>
              </ListGroup>
            )}
          </ScrollView>
          <StickyFooter>
            <View style={{ flexDirection: 'row', gap: sp[3] }}>
              <Button variant="secondary" icon="coins" title="Denomination" onPress={() => setDenomOpen(true)} style={{ flex: 1 }} />
              <Button icon="printer" title="Print" loading={busy} onPress={print} style={{ flex: 1 }} />
            </View>
          </StickyFooter>
        </>
      )}
      <DenominationSheet visible={denomOpen} onClose={() => setDenomOpen(false)} />
    </View>
  )
}
