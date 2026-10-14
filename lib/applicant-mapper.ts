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
    documents: {
      // Blank rows are dropped: the form lets a user add one and abandon it.
      create: draft.documents
        .filter((doc) => doc.docType.trim() && doc.docNumber.trim())
        .map((doc) => ({
          docType: doc.docType.trim(),
          docNumber: doc.docNumber.trim(),
        })),
    },

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
} satisfies Prisma.ApplicantSelect
