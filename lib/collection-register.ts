import type { CollectionMode } from "./collection-schema"

/** One receipt as the Collections page lists it. */
export type RegisterRow = {
  id: number
  receiptNo: string
  customerName: string
  group: string
  installment: number
  amount: number
  mode: CollectionMode
  /** dd/MM/yyyy, the business day it counts towards. */
  date: string
  collectedBy: string
  /** Route code, set on receipts written by the route app. */
  route: string | null
  reference: string | null
}

/** Today's takings across everything the caller may see, plus the selection's. */
export type RegisterStats = {
  todayTotal: number
  /** The rest follow the filters. */
  receiptsTotal: number
  receiptCount: number
  byMode: Partial<Record<CollectionMode, number>>
}

export type RegisterPage = {
  rows: RegisterRow[]
  total: number
  totalPages: number
  stats: RegisterStats
}

/** What the filter menus offer, limited to the caller's branches. */
export type RegisterFilters = {
  routes: { id: number; code: string; name: string }[]
  groups: string[]
  collectors: string[]
}

/** One receipt in full, as the receipt dialog shows and prints it. */
export type ReceiptDetail = {
  id: number
  receiptNo: string
  name: string
  group: string
  ticketNo: number | null
  installment: number
  amount: number
  mode: string
  reference: string
  note: string
  /** dd/MM/yyyy, the business day it counts towards. */
  date: string
  createdAt: string
  collectedBy: string
  accountNo: string
  mobile: string
  route: { code: string; name: string; branch: string } | null
  company: { name: string; phone: string; address: string }
  /** Still owed on the seat now, after this and any later payments. */
  balance: number
  monthlyDue: number
}
