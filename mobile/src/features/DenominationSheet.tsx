import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, View } from 'react-native'

import { api } from '@/api/client'
import type { Counts, Denomination } from '@/api/types'
import { invalidateAll } from '@/api/useApi'
import { Icon } from '@/components/Icon'
import { Sheet, useOverlay } from '@/components/overlays'
import { Button, Field, InlineAlert, Pill, Stepper, Txt } from '@/components/ui'
import { dLong, inr } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs, sp } from '@/theme/tokens'

const NOTES = [500, 200, 100, 50, 20, 10] as const
const COINS = [5, 2, 1] as const
type Face = (typeof NOTES)[number] | (typeof COINS)[number]

const totalOf = (counts: Counts) =>
  [...NOTES, ...COINS].reduce((s, v) => s + v * (counts[`${v}` as keyof Counts] ?? 0), 0)

/**
 * The day's cash, counted note by note. This is the only place the count is
 * entered — the admin site shows it against the route's cash receipts.
 */
export function DenominationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme()
  const { toast } = useOverlay()
  const [data, setData] = useState<Denomination | null>(null)
  const [counts, setCounts] = useState<Counts>({})
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState('')
  // Shown in the sheet: a toast would sit behind it, out of sight.
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) {
      setData(null)
      setError('')
      setSaveError('')
    }
  }

  useEffect(() => {
    if (!visible) return
    api<Denomination>('/api/v1/route/denomination')
      .then((d) => {
        setData(d)
        setCounts(d.tally?.counts ?? {})
        setRemarks(d.tally?.remarks ?? '')
      })
      .catch((e: Error) => {
        toast(e.message, 'error')
        onClose()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const total = totalOf(counts)
  const cash = data?.cash ?? 0
  const diff = total - cash
  const matched = total > 0 && diff === 0
  const canSave = !!data && total > 0 && (matched || remarks.trim().length > 0)

  const set = (v: Face, n: number) => setCounts((cur) => ({ ...cur, [`${v}`]: n }))

  async function save() {
    if (!data) return
    if (!matched && !remarks.trim()) {
      setError('Say why the cash is short or over')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      await api('/api/v1/route/denomination', {
        method: 'PUT',
        body: JSON.stringify({ date: data.date, counts, remarks: matched ? '' : remarks.trim() }),
      })
      invalidateAll()
      onClose()
      toast(matched ? 'Denomination saved · matches cash' : 'Denomination saved with note')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const status = !total ? (
    <Pill label="Enter counts" dot={false} />
  ) : diff === 0 ? (
    <Pill tone="success" label="Matched" dot={false} />
  ) : diff < 0 ? (
    <Pill tone="warning" label={`Short ${inr(-diff)}`} dot={false} />
  ) : (
    <Pill tone="danger" label={`Excess ${inr(diff)}`} dot={false} />
  )

  const row = (v: Face) => {
    const n = counts[`${v}` as keyof Counts] ?? 0
    return (
      <View key={v} style={{ flexDirection: 'row', alignItems: 'center', gap: sp[3], paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.divider }}>
        <Txt weight="bold" num color={c.ink} style={{ width: 52 }}>
          {inr(v)}
        </Txt>
        <Stepper value={n} onChange={(x) => set(v, x)} label={`₹${v}`} />
        <Txt weight="bold" num color={n ? c.ink : c.subtle} style={{ flex: 1, textAlign: 'right' }}>
          {inr(v * n)}
        </Txt>
      </View>
    )
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Cash denomination"
      sub={data ? `${dLong(data.date)} · Cash collected ${inr(cash)}` : 'Loading…'}
      footer={
        <View style={{ gap: sp[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Txt size={fs.xs} muted>
                Counted
              </Txt>
              <Txt size={fs.xl} weight="bold" num color={c.ink}>
                {inr(total)}
              </Txt>
            </View>
            {status}
          </View>
          <Button title={saving ? 'Saving…' : 'Save denomination'} icon="check" loading={saving} disabled={!canSave} onPress={save} block />
        </View>
      }
    >
      {saveError ? (
        <InlineAlert tone="danger" icon="alertCircle" style={{ marginBottom: sp[3] }}>
          {saveError}
        </InlineAlert>
      ) : null}
      {!data ? (
        <ActivityIndicator style={{ paddingVertical: sp[8] }} color={c.primary} />
      ) : (
        <>
          <Txt size={fs.xs} weight="bold" muted style={{ letterSpacing: 0.6, marginBottom: 4 }}>
            NOTES
          </Txt>
          {NOTES.map(row)}
          <Txt size={fs.xs} weight="bold" muted style={{ letterSpacing: 0.6, marginTop: sp[4], marginBottom: 4 }}>
            COINS
          </Txt>
          {COINS.map(row)}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: sp[2], marginBottom: sp[4] }}>
            <Pressable onPress={() => setCounts({})} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}>
              <Icon name="refresh" size={15} color={c.primary} />
              <Txt size={fs.sm} weight="semibold" color={c.primary}>
                Reset counts
              </Txt>
            </Pressable>
            <Txt size={12} muted>
              Tap a number to type it
            </Txt>
          </View>

          {total > 0 && !matched ? (
            <Field
              label="Reason for the difference"
              placeholder="e.g. ₹500 handed to branch earlier"
              value={remarks}
              onChangeText={(t) => {
                setRemarks(t)
                setError('')
              }}
              error={error}
              hint="Required when the count does not match the cash collected."
              multiline
              maxLength={500}
            />
          ) : null}
        </>
      )}
    </Sheet>
  )
}
