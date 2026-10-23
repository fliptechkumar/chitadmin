import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'

import type { Receipt } from '@/api/types'
import { useApi } from '@/api/useApi'
import { Icon } from '@/components/Icon'
import { useOverlay } from '@/components/overlays'
import { AppBar, Button, ErrorState, IconButton, KV, Pill, SkeletonCards, StickyFooter, Txt } from '@/components/ui'
import { usePrinter } from '@/features/usePrinter'
import { receiptEscPos } from '@/lib/escpos'
import { dLong, inr, MODE_LABEL, timeOf, titleCase } from '@/lib/format'
import { receiptHtml, shareHtmlAsPdf } from '@/lib/print'
import { useTheme } from '@/theme/theme'
import { fs, radius, shadow, sp } from '@/theme/tokens'

const MODE_ICON = { cash: 'cash', online: 'upi', cheque: 'bank' } as const

export default function ReceiptScreen() {
  const { c, isDark } = useTheme()
  const { toast } = useOverlay()
  const { print } = usePrinter()
  const params = useLocalSearchParams<{ id: string; fresh?: string; applied?: string }>()
  const fresh = params.fresh === '1'
  const { data: r, error, loading, refresh } = useApi<Receipt>(`/api/v1/route/collections/${params.id}`)
  const [busy, setBusy] = useState<'print' | 'share' | null>(null)

  const applied = useMemo(() => {
    try {
      return params.applied ? (JSON.parse(params.applied) as { installmentNo: number; amount: number }[]) : undefined
    } catch {
      return undefined
    }
  }, [params.applied])

  async function run(kind: 'print' | 'share') {
    if (!r) return
    setBusy(kind)
    try {
      if (kind === 'print') await print({ escpos: () => receiptEscPos(r, applied), html: () => receiptHtml(r, applied) })
      else await shareHtmlAsPdf(receiptHtml(r, applied), `Receipt ${r.receiptNo}`)
    } catch (e) {
      // Cancelling the print dialog lands here on some phones; stay quiet.
      const msg = e instanceof Error ? e.message : ''
      if (msg && !/cancel/i.test(msg)) toast(msg, 'error')
    } finally {
      setBusy(null)
    }
  }

  const instalments = applied?.length
    ? applied.map((a) => `#${a.installmentNo}${applied.length > 1 ? ` (${inr(a.amount)})` : ''}`).join(', ')
    : r
      ? `From #${r.installment}`
      : ''

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AppBar title="Receipt" back actions={<IconButton name="share" label="Share receipt" onPress={() => run('share')} />} />
      {error && !r ? (
        <ErrorState message={error.message} onRetry={refresh} />
      ) : loading || !r ? (
        <View style={{ padding: sp[4] }}>
          <SkeletonCards n={2} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: sp[4], paddingBottom: sp[6] }}>
            {fresh && (
              <View style={{ alignItems: 'center', marginBottom: sp[5], marginTop: sp[2] }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.success, alignItems: 'center', justifyContent: 'center', marginBottom: sp[3] }}>
                  <Icon name="check" size={30} color="#fff" strokeWidth={2.6} />
                </View>
                <Txt size={fs.xl} weight="bold" color={c.ink}>
                  Payment recorded
                </Txt>
                <Txt size={fs.sm} muted style={{ marginTop: 4 }}>
                  Saved to the member&apos;s ledger
                </Txt>
              </View>
            )}

            <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.divider, overflow: 'hidden', ...shadow(2, isDark) }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: sp[4] }}>
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" color={c.ink}>
                    {r.company.name}
                  </Txt>
                  <Txt size={fs.sm} muted style={{ marginTop: 2 }}>
                    {r.route ? `${r.route.branch} · ${r.route.code} ${titleCase(r.route.name)}` : r.company.address}
                  </Txt>
                </View>
                <Pill tone="info" label="RECEIPT" dot={false} />
              </View>
              <View style={{ alignItems: 'center', paddingBottom: sp[4], gap: 6 }}>
                <Txt size={fs.sm} muted>
                  Amount paid
                </Txt>
                <Txt size={fs['3xl']} weight="bold" num color={c.ink}>
                  {inr(r.amount)}
                </Txt>
                <Pill tone="success" icon={MODE_ICON[r.mode]} label={MODE_LABEL[r.mode]} />
              </View>
              {/* Tear line */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 12, height: 24, borderTopRightRadius: 12, borderBottomRightRadius: 12, backgroundColor: c.bg, marginLeft: -1 }} />
                <View style={{ flex: 1, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: c.border }} />
                <View style={{ width: 12, height: 24, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, backgroundColor: c.bg, marginRight: -1 }} />
              </View>
              <View style={{ paddingHorizontal: sp[4], paddingVertical: sp[2] }}>
                <KV first k="Receipt no" v={r.receiptNo} />
                <KV k="Date & time" v={`${dLong(r.date)}, ${timeOf(r.createdAt)}`} />
                <KV k="Customer" v={titleCase(r.name)} />
                {r.accountNo ? <KV k="Account no" v={r.accountNo} /> : null}
                <KV k="Group / Ticket" v={`${r.group} / ${r.ticketNo ?? '—'}`} />
                <KV k="Instalment" v={instalments} />
                {r.reference ? <KV k="Reference" v={r.reference} /> : null}
                {r.note ? <KV k="Note" v={r.note} /> : null}
                <KV k="Monthly due" v={inr(r.monthlyDue)} />
                <KV k="Balance pending" v={inr(r.balance)} vColor={r.balance ? c.danger : c.success} />
              </View>
              <View style={{ backgroundColor: c.surface2, paddingVertical: sp[3], borderTopWidth: 1, borderTopColor: c.divider }}>
                <Txt size={fs.xs} muted align="center">
                  Collected by {r.collectedBy}
                </Txt>
              </View>
            </View>
          </ScrollView>
          <StickyFooter>
            <View style={{ flexDirection: 'row', gap: sp[3] }}>
              <Button variant="outline" title={fresh ? 'Done' : 'Close'} onPress={() => router.back()} style={{ flex: 1 }} />
              <Button icon="printer" title="Print receipt" loading={busy === 'print'} onPress={() => run('print')} style={{ flex: 1.3 }} />
            </View>
          </StickyFooter>
        </>
      )}
    </View>
  )
}
