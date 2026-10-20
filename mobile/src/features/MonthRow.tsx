import { View } from 'react-native'

import type { MonthRecord } from '@/api/types'
import { ListRow, StatusPill, Txt } from '@/components/ui'
import { dShort, inr, MONTHS, toDate } from '@/lib/format'
import { useTheme } from '@/theme/theme'
import { fs } from '@/theme/tokens'

const MONTH_PILL: Record<MonthRecord['status'], string> = {
  paid: 'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  due: 'Due',
  upcoming: 'Upcoming',
  advance: 'Advance',
}

/** One month of the ledger (the prototype's rec-row). */
export function MonthRow({ r, onPress }: { r: MonthRecord; onPress?: () => void }) {
  const { c } = useTheme()
  const d = toDate(r.dueDate)
  return (
    <ListRow
      onPress={onPress}
      lead={
        <View style={{ width: 44, alignItems: 'center', paddingVertical: 4, borderRadius: 10, backgroundColor: c.surface2 }}>
          <Txt size={fs.sm} weight="bold" color={c.ink}>
            {d ? MONTHS[d.getMonth()] : '—'}
          </Txt>
          <Txt size={10} muted>
            {d?.getFullYear()}
          </Txt>
        </View>
      }
      title={`Instalment ${r.installmentNo}`}
      sub={r.paidOn ? `Paid ${dShort(r.paidOn)}` : `Due ${dShort(r.dueDate)}`}
      end={
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Txt weight="bold" num color={c.ink}>
            {inr(r.amountPaid > 0 ? r.amountPaid : r.amountDue)}
          </Txt>
          <StatusPill status={r.status} label={r.status === 'partial' ? `Partial · ${inr(r.amountDue - r.amountPaid)} left` : MONTH_PILL[r.status]} />
        </View>
      }
    />
  )
}
