import "server-only"

import { branchForGroup } from "./collection-scope"
import { getCompany } from "@/lib/company"

/** Header block for the printed receipt, taken from Settings → Company. */
export type ReceiptCompany = {
  name: string
  shortName: string
  regNo: string
  gst: string
  phone: string
  address: string
  /** Data URI, or "" — the app decides whether its printer can render it. */
  logo: string
}

export type ReceiptPayload = {
  receiptNo: string
  date: string
  company: ReceiptCompany
  branch: string | null
  customer: { id: number; name: string; phone: string }
  group: string
  installment: number
  /** Paise-free rupee integers; the app formats for its own locale. */
  amount: number
  penalty: number
  total: number
  mode: string
  status: string
  collectedBy: string
}

type CollectionRow = {
  receiptNo: string
  date: string
  customerId: number
  customerName: string
  group: string
  installment: number
  amount: number
  penalty: number
  mode: string
  status: string
  collectedBy: string
  customer?: { phone: string } | null
}

/**
 * Everything a printer needs in one object, so the app never has to stitch a
 * receipt together from several calls while standing at someone's door.
 */
export async function buildReceipt(row: CollectionRow): Promise<ReceiptPayload> {
  const [company, branch] = await Promise.all([
    getCompany(),
    branchForGroup(row.group),
  ])

  // Address is pre-joined so the app prints one line without reassembling it.
  const address = [company.addressLine, company.city, company.state, company.pincode]
    .filter(Boolean)
    .join(", ")

  return {
    receiptNo: row.receiptNo,
    date: row.date,
    company: {
      name: company.name,
      shortName: company.shortName,
      regNo: company.regNo,
      gst: company.gst,
      phone: company.phone,
      address,
      logo: company.logo,
    },
    branch,
    customer: {
      id: row.customerId,
      name: row.customerName,
      phone: row.customer?.phone ?? "",
    },
    group: row.group,
    installment: row.installment,
    amount: row.amount,
    penalty: row.penalty,
    total: row.amount + row.penalty,
    mode: row.mode,
    status: row.status,
    collectedBy: row.collectedBy,
  }
}
