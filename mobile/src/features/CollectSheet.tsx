import { router } from 'expo-router'
import { useState } from 'react'
import { Keyboard, View } from 'react-native'

import { api, ApiError } from '@/api/client'
import type { CollectResult, Member, Mode } from '@/api/types'
import { invalidateAll } from '@/api/useApi'
import { Sheet } from '@/components/overlays'
import { Button, Chip, Field, InlineAlert, KV, Segmented, Txt } from '@/components/ui'
import { inr, MODE_LABEL, titleCase } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs, radius, sp } from '@/theme/tokens'

const MODES: { value: Mode; label: string; icon: 'cash' | 'upi' | 'bank' }[] = [
  { value: 'cash', label: 'Cash', icon: 'cash' },
  { value: 'online', label: 'Online', icon: 'upi' },
  { value: 'cheque', label: 'Cheque', icon: 'bank' },
]

/** What to suggest: this month's balance, else arrears, else next month. */
function suggested(m: Member) {
  if (m.currentDue > 0) return m.currentDue
  if (m.outstanding > 0) return Math.min(m.outstanding, m.monthlyDue || m.outstanding)
  return m.monthlyDue
}

export function CollectSheet({ member: incoming, visible, onClose }: { member: Member | null; visible: boolean; onClose: () => void }) {
  const { c } = useTheme()
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<Mode>('cash')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  // Confirmation is a second step inside this sheet, not a separate dialog:
  // phones will not reliably show one modal on top of another, which left
  // "Record payment" doing nothing (iOS) or the screen frozen (Android).
  const [confirming, setConfirming] = useState(false)
  const [saveError, setSaveError] = useState('')
  // Keep the last member while the sheet slides away after the caller clears it.
  const [member, setMember] = useState(incoming)
  if (incoming && incoming !== member) setMember(incoming)

  // Fresh form each time the sheet opens for a member.
  const openKey = visible && member ? member.ticketId : null
  const [formFor, setFormFor] = useState<number | null>(null)
  if (openKey !== formFor) {
    setFormFor(openKey)
    if (openKey !== null && member) {
      setAmount(String(suggested(member)))
      setMode('cash')
      setReference('')
      setNote('')
      setErrors({})
      setConfirming(false)
      setSaveError('')
    }
  }

  if (!member) return null

  const first = suggested(member)
  const pending = member.outstanding
  const v = Number(amount) || 0
  const advance = pending === 0

  const hint =
    v > pending && pending > 0
      ? `${inr(v - pending)} more than pending — it is credited to the coming months.`
      : advance && v > 0
        ? 'Nothing is pending — this is credited as an advance for the coming months.'
        : v > 0 && v < first
          ? `Part payment — ${inr(first - v)} of this month stays pending.`
          : 'Credited to the oldest unpaid month first.'

  function review() {
    const next: Record<string, string> = {}
    if (!/^\d+$/.test(amount) || v <= 0) next.amount = 'Enter an amount greater than ₹0'
    if (mode !== 'cash' && reference.trim().length < 4) next.reference = mode === 'cheque' ? 'Enter the cheque number' : 'Enter the UTR / reference number'
    setErrors(next)
    if (Object.keys(next).length) return
    Keyboard.dismiss()
    setSaveError('')
    setConfirming(true)
  }

  async function save() {
    setSaving(true)
    setSaveError('')
    try {
      const res = await api<CollectResult>('/api/v1/route/collections', {
        method: 'POST',
        body: JSON.stringify({ ticketId: member!.ticketId, amount: v, mode, reference: reference.trim(), note: note.trim() }),
      })
      invalidateAll()
      onClose()
      router.push({
        pathname: '/receipt/[id]',
        params: { id: String(res.receipt.id), fresh: '1', applied: JSON.stringify(res.applied) },
      })
    } catch (e) {
      // A field problem sends the agent back to the form to fix it.
      if (e instanceof ApiError && Object.keys(e.fields).length) {
        setErrors(e.fields)
        setConfirming(false)
      }
      setSaveError(e instanceof Error ? e.message : 'Could not save the payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={confirming ? 'Confirm collection' : 'Collect payment'}
      sub={`${titleCase(member.name)} · ${member.group} / ${member.ticketNo}`}
      footer={
        confirming ? (
          <View style={{ flexDirection: 'row', gap: sp[3] }}>
            <Button variant="outline" title="Back" onPress={() => setConfirming(false)} disabled={saving} style={{ flex: 1 }} />
            <Button title={saving ? 'Saving…' : 'Confirm'} icon="check" loading={saving} onPress={save} style={{ flex: 1.4 }} />
          </View>
        ) : (
          <Button title="Record payment" icon="check" onPress={review} block />
        )
      }
    >
      {saveError ? (
        <InlineAlert tone="danger" icon="alertCircle" style={{ marginBottom: sp[4] }}>
          {saveError}
        </InlineAlert>
      ) : null}
      {confirming ? (
        <View style={{ backgroundColor: c.surface2, borderWidth: 1, borderColor: c.divider, borderRadius: radius.md, paddingHorizontal: sp[4], paddingVertical: 4, marginBottom: sp[2] }}>
          <KV first k="Customer" v={titleCase(member.name)} />
          <KV k="Group / Ticket" v={`${member.group} / ${member.ticketNo}`} />
          <KV k="Mode" v={MODE_LABEL[mode]} />
          {reference.trim() ? <KV k={mode === 'cheque' ? 'Cheque no' : 'Reference'} v={reference.trim()} /> : null}
          {note.trim() ? <KV k="Note" v={note.trim()} /> : null}
          <KV k="Amount" v={inr(v)} vColor={c.primary} big />
        </View>
      ) : (
      <>
      <View style={{ flexDirection: 'row', backgroundColor: c.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: c.divider, paddingVertical: sp[3], marginBottom: sp[4] }}>
        {[
          ['Instalment', `#${member.currentInstallment} of ${member.months}`],
          ['This month', inr(member.currentDue)],
          ['Total pending', inr(pending)],
        ].map(([k, val], i) => (
          <View key={k} style={{ flex: 1, paddingHorizontal: sp[3], borderLeftWidth: i ? 1 : 0, borderLeftColor: c.divider }}>
            <Txt size={fs.xs} muted>
              {k}
            </Txt>
            <Txt size={fs.sm} weight="bold" num color={i === 2 && pending > member.currentDue ? c.danger : c.ink} style={{ marginTop: 3 }} numberOfLines={1}>
              {val}
            </Txt>
          </View>
        ))}
      </View>

      <Field
        label="Amount received"
        prefix="₹"
        large
        keyboardType="number-pad"
        value={amount}
        onChangeText={(t) => {
          setAmount(t.replace(/\D/g, '').slice(0, 8))
          setErrors((e) => ({ ...e, amount: '' }))
        }}
        error={errors.amount}
        hint={hint}
        hintWarn={v > pending && pending > 0}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp[2], marginTop: -sp[2], marginBottom: sp[4] }}>
        <Chip label={`${advance ? 'Next month' : 'This month'} ${inr(first)}`} active={v === first} onPress={() => setAmount(String(first))} />
        {pending > first && <Chip label={`All pending ${inr(pending)}`} active={v === pending} onPress={() => setAmount(String(pending))} />}
        {first > 1 && <Chip label={`Half ${inr(Math.round(first / 2))}`} active={v === Math.round(first / 2)} onPress={() => setAmount(String(Math.round(first / 2)))} />}
      </View>

      <Txt size={fs.sm} weight="semibold" style={{ marginBottom: 6 }}>
        Payment mode
      </Txt>
      <Segmented options={MODES} value={mode} onChange={setMode} style={{ marginBottom: sp[4] }} />

      {mode !== 'cash' && (
        <Field
          label={mode === 'cheque' ? 'Cheque number' : 'Transaction reference'}
          icon="idcard"
          placeholder={mode === 'cheque' ? 'Cheque number' : 'UTR / reference number'}
          value={reference}
          autoCapitalize="characters"
          onChangeText={(t) => {
            setReference(t)
            setErrors((e) => ({ ...e, reference: '' }))
          }}
          error={errors.reference}
        />
      )}

      <Field label="Note" optional placeholder="e.g. Collected at shop" value={note} onChangeText={setNote} multiline maxLength={300} />
      <Txt size={fs.xs} muted style={{ marginTop: -sp[2] }}>
        Dated today and recorded on your route. Corrections are made by the branch office.
      </Txt>
      </>
      )}
    </Sheet>
  )
}
