import { router } from 'expo-router'
import { memo } from 'react'
import { Linking, View } from 'react-native'

import type { Member } from '@/api/types'
import { Icon } from '@/components/Icon'
import { Avatar, Button, Card, IconButton, Pill, StatusPill, Txt } from '@/components/ui'
import { dShort, inr, titleCase } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs, sp } from '@/theme/tokens'

export const callNumber = (mobile: string) => {
  if (mobile) Linking.openURL(`tel:${mobile.replace(/\s+/g, '')}`).catch(() => {})
}

/** One member in the Customers list (the prototype's cust-card). */
export const MemberCard = memo(function MemberCard({ m, onCollect }: { m: Member; onCollect: (m: Member) => void }) {
  const { c } = useTheme()
  const open = () => router.push({ pathname: '/member/[id]', params: { id: String(m.ticketId) } })
  return (
    <Card onPress={open} style={{ marginBottom: sp[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp[3], padding: sp[4], paddingBottom: sp[3] }}>
        <Avatar name={m.name} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt weight="semibold" color={c.ink} numberOfLines={1}>
            {titleCase(m.name)}
          </Txt>
          <Txt size={fs.sm} muted numberOfLines={1} style={{ marginTop: 2 }}>
            {m.group} · Ticket {m.ticketNo} · #{m.accountNo}
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <StatusPill status={m.status} />
          {m.isPrized && <Pill tone="violet" label="Prized" dot={false} />}
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginHorizontal: sp[4], paddingVertical: sp[3], borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.divider }}>
        {[
          ['Instalment', inr(m.monthlyDue), c.ink],
          ['Pending', inr(m.outstanding), m.outstanding ? c.danger : c.ink],
          ['Inst. no', `${m.currentInstallment}/${m.months}`, c.ink],
        ].map(([k, v, col], i) => (
          <View key={k} style={{ flex: 1, paddingLeft: i ? sp[3] : 0 }}>
            <Txt size={fs.xs} muted>
              {k}
            </Txt>
            <Txt size={fs.sm} weight="bold" num color={col} style={{ marginTop: 2 }} numberOfLines={1}>
              {v}
            </Txt>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp[2], paddingHorizontal: sp[4], paddingVertical: sp[2] }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <Icon name="pin" size={14} color={c.muted} />
          <Txt size={12} muted numberOfLines={1} style={{ flexShrink: 1 }}>
            {m.area ? titleCase(m.area) : 'No area'}
            {m.nextDueDate && m.outstanding ? ` · since ${dShort(m.nextDueDate)}` : ''}
          </Txt>
        </View>
        {m.mobile ? <IconButton name="phone" size={17} label={`Call ${m.name}`} onPress={() => callNumber(m.mobile)} color={c.primary} /> : null}
        <Button small title={m.outstanding ? 'Collect' : 'Advance'} variant={m.outstanding ? 'primary' : 'secondary'} onPress={() => onCollect(m)} />
      </View>
    </Card>
  )
})
