import "server-only"

import type { Prisma } from "@/lib/generated/prisma"

import type { ApplicantDraft } from "./applicant-schema"

/** "" -> null, so optional text columns stay empty rather than blank strings. */
function text(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

/** "" -> null, otherwise a Date. Invalid input is treated as absent. */
function date(value: string): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function int(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

/** Blank rows are dropped: the form lets a user add one and abandon it. */
function documentRows(draft: ApplicantDraft) {
  return draft.documents
    .filter((doc) => doc.docType.trim() && doc.docNumber.trim())
    .map((doc) => ({ docType: doc.docType.trim(), docNumber: doc.docNumber.trim() }))
}

/**
 * Turns a validated form draft into Prisma create input. Assumes the draft has
 * already passed validateAll — this only reshapes, it does not re-check.
 */
export function draftToCreateData(
  draft: ApplicantDraft,
  applicantCode: string
): Prisma.ApplicantCreateInput {
  return {
    applicantCode,
    branch: draft.branch.trim(),

    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    mobile: draft.mobile.trim(),
    dateOfBirth: date(draft.dateOfBirth),
    gender: text(draft.gender),
    maritalStatus: text(draft.maritalStatus),
    signDate: date(draft.signDate),
    aadhaarNumber: draft.aadhaarNumber.replace(/\s/g, ""),
    documents: { create: documentRows(draft) },

    email: text(draft.email),
    altPhone: text(draft.altPhone),
    addressLine1: text(draft.addressLine1),
    addressLine2: text(draft.addressLine2),
    area: text(draft.area),
    city: text(draft.city),
    state: text(draft.state),
    pincode: text(draft.pincode),
    // The toggle means "same as current", so no separate value is stored.
    permanentAddress: draft.permanentSameAsCurrent
      ? null
      : text(draft.permanentAddress),

    occupationType: text(draft.occupationType),
    employerName: text(draft.employerName),
    natureOfBusiness: text(draft.natureOfBusiness),
    annualIncome: int(draft.annualIncome),
    yearsInOccupation: int(draft.yearsInOccupation),

    introducerName: text(draft.introducerName),
    introducerId: text(draft.introducerId),
    nomineeName: text(draft.nomineeName),
    nomineeRelation: text(draft.nomineeRelation),
    nomineeDob: date(draft.nomineeDob),
    nomineeMobile: text(draft.nomineeMobile),

    chitValue: int(draft.chitValue) ?? 0,
  }
}

/**
 * Update input for a validated draft. The extra documents are replaced as a
 * set, since the form edits them as one list rather than row by row.
 */
export function draftToUpdateData(draft: ApplicantDraft): Prisma.ApplicantUpdateInput {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { applicantCode, documents, ...fields } = draftToCreateData(draft, "")
  return { ...fields, documents: { deleteMany: {}, create: documentRows(draft) } }
}

/** Columns the edit form needs to start from a saved applicant. */
export const APPLICANT_EDIT_SELECT = {
  branch: true,
  firstName: true,
  lastName: true,
  mobile: true,
  dateOfBirth: true,
  gender: true,
  maritalStatus: true,
  signDate: true,
  aadhaarNumber: true,
  documents: { select: { docType: true, docNumber: true }, orderBy: { id: "asc" } },
  chitValue: true,
  email: true,
  altPhone: true,
  addressLine1: true,
  addressLine2: true,
  area: true,
  city: true,
  state: true,
  pincode: true,
  permanentAddress: true,
  occupationType: true,
  employerName: true,
  natureOfBusiness: true,
  annualIncome: true,
  yearsInOccupation: true,
  introducerName: true,
  introducerId: true,
  nomineeName: true,
  nomineeRelation: true,
  nomineeDob: true,
  nomineeMobile: true,
} satisfies Prisma.ApplicantSelect

type EditableApplicant = Prisma.ApplicantGetPayload<{ select: typeof APPLICANT_EDIT_SELECT }>

/** A saved applicant back into the form's all-string draft shape. */
export function applicantToDraft(a: EditableApplicant): ApplicantDraft {
  const str = (v: string | null) => v ?? ""
  const num = (v: number | null) => (v === null ? "" : String(v))
  // Dates are stored at UTC midnight of the picked day, so the ISO date is that day.
  const day = (v: Date | null) => (v ? v.toISOString().slice(0, 10) : "")

  return {
    mobile: a.mobile,
    branch: a.branch,
    firstName: a.firstName,
    lastName: a.lastName,
    dateOfBirth: day(a.dateOfBirth),
    gender: str(a.gender),
    maritalStatus: str(a.maritalStatus),
    signDate: day(a.signDate),
    aadhaarNumber: a.aadhaarNumber,
    documents: a.documents.map((d) => ({ docType: d.docType, docNumber: d.docNumber })),
    chitValue: a.chitValue ? String(a.chitValue) : "",

    email: str(a.email),
    altPhone: str(a.altPhone),
    addressLine1: str(a.addressLine1),
    addressLine2: str(a.addressLine2),
    area: str(a.area),
    city: str(a.city),
    state: str(a.state),
    pincode: str(a.pincode),
    permanentSameAsCurrent: !a.permanentAddress,
    permanentAddress: str(a.permanentAddress),

    occupationType: str(a.occupationType),
    employerName: str(a.employerName),
    natureOfBusiness: str(a.natureOfBusiness),
    annualIncome: num(a.annualIncome),
    yearsInOccupation: num(a.yearsInOccupation),

    introducerName: str(a.introducerName),
    introducerId: str(a.introducerId),
    nomineeName: str(a.nomineeName),
    nomineeRelation: str(a.nomineeRelation),
    nomineeDob: day(a.nomineeDob),
    nomineeMobile: str(a.nomineeMobile),
  }
}

/** Columns the list screen needs. Keeps the payload small. */
export const APPLICANT_LIST_SELECT = {
  id: true,
  applicantCode: true,
  branch: true,
  firstName: true,
  lastName: true,
  mobile: true,
  area: true,
  introducerName: true,
  chitValue: true,
  status: true,
  documentsUploaded: true,
  createdAt: true,
  assignedTo: { select: { id: true, name: true } },
  // Seats taken in chit groups. One applicant can hold several, closed ones
  // included, so the list shows where they have been enrolled.
  tickets: {
    select: { id: true, ticketNo: true, status: true, group: { select: { id: true, group: true } } },
    orderBy: [{ group: { group: "asc" } }, { ticketNo: "asc" }],
  },
} satisfies Prisma.ApplicantSelect
