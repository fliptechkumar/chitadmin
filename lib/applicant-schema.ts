/**
 * Shape and validation rules for a new chit applicant.
 *
 * Validation is per-step so the form can gate "Next" on just the fields the
 * user has actually reached, then re-run every step before submitting.
 */

export const APPLICANT_STEPS = [
  "applicant",
  "communication",
  "business",
  "introducer",
] as const

export type ApplicantStep = (typeof APPLICANT_STEPS)[number]

export const GENDERS = ["Male", "Female", "Other"] as const
export const MARITAL_STATUSES = ["Married", "Unmarried"] as const
export const OCCUPATION_TYPES = [
  "Salaried",
  "Self-employed",
  "Business owner",
  "Retired",
] as const
/**
 * Types available for the optional extra proofs. Aadhaar is deliberately absent
 * — it has its own mandatory field, and listing it here would allow two
 * conflicting Aadhaar numbers on one applicant.
 */
export const ID_DOCUMENT_TYPES = [
  "PAN",
  "Voter ID",
  "Driving licence",
  "Passport",
  "Ration card",
] as const

/** One additional proof: a type paired with its number. */
export type ApplicantDocumentDraft = {
  docType: string
  docNumber: string
}

export function emptyDocument(): ApplicantDocumentDraft {
  return { docType: "", docNumber: "" }
}
export const NOMINEE_RELATIONS = [
  "Spouse",
  "Son",
  "Daughter",
  "Father",
  "Mother",
  "Brother",
  "Sister",
  "Other",
] as const

export type ApplicantDraft = {
  // Applicant details
  mobile: string
  branch: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  maritalStatus: string
  signDate: string
  /** Mandatory 12-digit Aadhaar. */
  aadhaarNumber: string
  /** Optional further proofs, each a type plus number. */
  documents: ApplicantDocumentDraft[]
  /** Chit value being enrolled for, in rupees. Shown as "Value" in the list. */
  chitValue: string

  // Communication details
  email: string
  altPhone: string
  addressLine1: string
  addressLine2: string
  /** Locality within the branch — the list's "Area" column. */
  area: string
  city: string
  state: string
  pincode: string
  permanentSameAsCurrent: boolean
  permanentAddress: string

  // Business details
  occupationType: string
  employerName: string
  natureOfBusiness: string
  annualIncome: string
  yearsInOccupation: string

  // Introducer and nominee
  introducerName: string
  introducerId: string
  nomineeName: string
  nomineeRelation: string
  nomineeDob: string
  nomineeMobile: string
}

export type ApplicantErrors = Partial<Record<keyof ApplicantDraft, string>> & {
  /** Messages for the repeatable documents list, keyed by row index. */
  documentRows?: Record<number, string>
}

/** "2026-08-14" -> today's date in the native date-input format. */
export function todayInputDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function emptyApplicant(defaultBranch = ""): ApplicantDraft {
  return {
    mobile: "",
    branch: defaultBranch,
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    // Sign date is almost always today, so it starts filled in rather than
    // forcing a pick on every applicant.
    signDate: todayInputDate(),
    aadhaarNumber: "",
    documents: [],
    chitValue: "",

    email: "",
    altPhone: "",
    addressLine1: "",
    addressLine2: "",
    area: "",
    city: "",
    state: "",
    pincode: "",
    permanentSameAsCurrent: true,
    permanentAddress: "",

    occupationType: "",
    employerName: "",
    natureOfBusiness: "",
    annualIncome: "",
    yearsInOccupation: "",

    introducerName: "",
    introducerId: "",
    nomineeName: "",
    nomineeRelation: "",
    nomineeDob: "",
    nomineeMobile: "",
  }
}

/**
 * Age in whole years, or null when the date is missing or nonsensical.
 * Derived rather than typed in — the reference form asked for both, which lets
 * the two disagree.
 */
export function ageFrom(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null

  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return null

  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()

  // Not yet had this year's birthday.
  const monthDelta = now.getMonth() - dob.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1
  }

  return age >= 0 && age < 130 ? age : null
}

const MOBILE_RE = /^[6-9]\d{9}$/
const AADHAAR_RE = /^\d{12}$/
const PINCODE_RE = /^[1-9]\d{5}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MIN_AGE = 18

function required(
  errors: ApplicantErrors,
  draft: ApplicantDraft,
  key: keyof ApplicantDraft,
  label: string
) {
  const value = draft[key]
  if (typeof value === "string" && !value.trim()) {
    errors[key] = `${label} is required`
  }
}

/** Validates one step in isolation. Returns the errors found, if any. */
export function validateStep(
  step: ApplicantStep,
  draft: ApplicantDraft
): ApplicantErrors {
  const errors: ApplicantErrors = {}

  if (step === "applicant") {
    if (!draft.mobile.trim()) errors.mobile = "Mobile number is required"
    else if (!MOBILE_RE.test(draft.mobile.trim())) {
      errors.mobile = "Enter a 10-digit Indian mobile number"
    }

    required(errors, draft, "branch", "Branch")
    required(errors, draft, "firstName", "First name")
    required(errors, draft, "lastName", "Last name")

    if (!draft.dateOfBirth) {
      errors.dateOfBirth = "Date of birth is required"
    } else {
      const age = ageFrom(draft.dateOfBirth)
      if (age === null) errors.dateOfBirth = "Enter a valid date of birth"
      else if (age < MIN_AGE) {
        errors.dateOfBirth = `Applicant must be at least ${MIN_AGE} years old`
      }
    }

    required(errors, draft, "signDate", "Sign date")

    if (!draft.chitValue.trim()) {
      errors.chitValue = "Chit value is required"
    } else {
      const value = Number(draft.chitValue)
      if (!Number.isFinite(value) || value < 1000) {
        errors.chitValue = "Enter an amount of at least ₹1,000"
      }
    }

    if (!draft.aadhaarNumber.trim()) {
      errors.aadhaarNumber = "Aadhaar number is required"
    } else if (!AADHAAR_RE.test(draft.aadhaarNumber.replace(/\s/g, ""))) {
      errors.aadhaarNumber = "Enter a 12-digit Aadhaar number"
    }

    const documentRows: Record<number, string> = {}
    const seenTypes = new Set<string>()

    draft.documents.forEach((doc, index) => {
      const type = doc.docType.trim()
      const number = doc.docNumber.trim()

      // A blank row is ignored rather than treated as an error — the user may
      // have added one and changed their mind.
      if (!type && !number) return

      if (!type) documentRows[index] = "Select a document type"
      else if (!number) documentRows[index] = `Enter the ${type} number`
      else if (seenTypes.has(type)) documentRows[index] = `${type} is already added`

      if (type) seenTypes.add(type)
    })

    if (Object.keys(documentRows).length > 0) {
      errors.documentRows = documentRows
      errors.documents = "Complete or remove the highlighted documents"
    }
  }

  if (step === "communication") {
    if (draft.email.trim() && !EMAIL_RE.test(draft.email.trim())) {
      errors.email = "Enter a valid email address"
    }

    if (draft.altPhone.trim() && !MOBILE_RE.test(draft.altPhone.trim())) {
      errors.altPhone = "Enter a 10-digit number"
    }

    required(errors, draft, "addressLine1", "Address")
    required(errors, draft, "area", "Area")
    required(errors, draft, "city", "City")
    required(errors, draft, "state", "State")

    if (!draft.pincode.trim()) errors.pincode = "Pincode is required"
    else if (!PINCODE_RE.test(draft.pincode.trim())) {
      errors.pincode = "Enter a 6-digit pincode"
    }

    if (!draft.permanentSameAsCurrent && !draft.permanentAddress.trim()) {
      errors.permanentAddress = "Enter the permanent address"
    }
  }

  if (step === "business") {
    required(errors, draft, "occupationType", "Occupation type")

    if (draft.annualIncome.trim()) {
      const income = Number(draft.annualIncome)
      if (!Number.isFinite(income) || income < 0) {
        errors.annualIncome = "Enter a valid amount"
      }
    }

    if (draft.yearsInOccupation.trim()) {
      const years = Number(draft.yearsInOccupation)
      if (!Number.isFinite(years) || years < 0 || years > 80) {
        errors.yearsInOccupation = "Enter a number between 0 and 80"
      }
    }
  }

  if (step === "introducer") {
    required(errors, draft, "nomineeName", "Nominee name")
    required(errors, draft, "nomineeRelation", "Relationship")

    if (draft.nomineeMobile.trim() && !MOBILE_RE.test(draft.nomineeMobile.trim())) {
      errors.nomineeMobile = "Enter a 10-digit number"
    }

    if (draft.nomineeDob) {
      const age = ageFrom(draft.nomineeDob)
      if (age === null) errors.nomineeDob = "Enter a valid date"
    }
  }

  return errors
}

/** Every step's errors, merged — used to gate submission. */
export function validateAll(draft: ApplicantDraft): ApplicantErrors {
  return APPLICANT_STEPS.reduce<ApplicantErrors>(
    (acc, step) => ({ ...acc, ...validateStep(step, draft) }),
    {}
  )
}
