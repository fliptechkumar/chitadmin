/** Shapes returned by the admin server's /api/v1/route/* endpoints. */

export type Mode = 'cash' | 'online' | 'cheque'
export type MemberStatus = 'paid' | 'due' | 'overdue'
export type MonthStatus = 'paid' | 'partial' | 'overdue' | 'due' | 'upcoming' | 'advance'

export type RouteRef = { id: number; code: string; name: string; branch: string }

export type SessionUser = {
  id: number
  username: string
  name: string
  route: RouteRef | null
}

export type Totals = {
  total: number
  cash: number
  online: number
  cheque: number
  receipts: number
}

export type ReceiptRow = {
  id: number
  receiptNo: string
  ticketId: number | null
  name: string
  group: string
  ticketNo: number | null
  installment: number
  amount: number
  mode: Mode
  reference: string
  date: string
  createdAt: string
}

export type Overview = {
  date: string
  route: RouteRef
  collector: string
  company: { name: string; shortName: string; phone: string }
  today: Totals & { target: number }
  counts: { members: number; paid: number; due: number; overdue: number; prized: number }
  arrears: { amount: number; accounts: number }
  outstanding: number
  recent: ReceiptRow[]
  denomination: { counted: boolean; total: number; cash: number }
}

export type Member = {
  ticketId: number
  ticketNo: number
  name: string
  accountNo: string
  mobile: string
  area: string
  groupId: number
  group: string
  chitValue: number
  months: number
  isPrized: boolean
  status: MemberStatus
  currentInstallment: number
  monthlyDue: number
  currentDue: number
  outstanding: number
  pendingMonths: number
  paidToDate: number
  nextDueDate: string | null
}

export type MonthRecord = {
  installmentNo: number
  dueDate: string
  amountDue: number
  amountPaid: number
  paidOn: string | null
  status: MonthStatus
}

export type MemberDetail = {
  member: Member & { branch: string; address: string; introducer: string }
  prize: { installmentNo: number; amount: number; date: string } | null
  records: MonthRecord[]
  receipts: ReceiptRow[]
}

export type Receipt = ReceiptRow & {
  note: string
  collectedBy: string
  accountNo: string
  mobile: string
  route: { code: string; name: string; branch: string } | null
  company: { name: string; shortName: string; phone: string; address: string }
  balance: number
  monthlyDue: number
}

export type CollectResult = {
  receipt: Receipt
  applied: { installmentNo: number; amount: number }[]
}

export type DayStatement = { date: string; rows: ReceiptRow[]; totals: Totals }

export type Counts = Partial<Record<'500' | '200' | '100' | '50' | '20' | '10' | '5' | '2' | '1', number>>

export type Denomination = {
  date: string
  cash: number
  tally: { counts: Counts; total: number; remarks: string; updatedAt: string } | null
}

export type GroupSummary = {
  id: number
  code: string
  value: number
  months: number
  seats: number
  status: 'active' | 'completed' | 'upcoming'
  startDate: string
  currentMonth: number
  membersOnRoute: number
  paidOnRoute: number
  monthlyDue: number
  nextAuction: { installmentNo: number; date: string } | null
}

export type GroupDetail = Omit<GroupSummary, 'membersOnRoute' | 'paidOnRoute'> & {
  endDate: string
  auctions: { installmentNo: number; date: string; prize: number; discount: number; dividend: number }[]
  members: Member[]
}

export type Report = {
  period: 'today' | 'week' | 'month'
  from: string
  to: string
  totals: Totals
  lastSevenDays: { date: string; amount: number }[]
  groups: { group: string; amount: number; receipts: number }[]
}
