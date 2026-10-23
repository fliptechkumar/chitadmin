"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  CircleCheck,
  IdCard,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  UserRound,
  Users2,
} from "lucide-react"

import { ChoiceGroup } from "@/components/ui/choice-group"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field, Input, Select, Textarea } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  ageFrom,
  APPLICANT_STEPS,
  emptyApplicant,
  emptyDocument,
  GENDERS,
  ID_DOCUMENT_TYPES,
  MARITAL_STATUSES,
  NOMINEE_RELATIONS,
  OCCUPATION_TYPES,
  validateAll,
  validateStep,
  type ApplicantDocumentDraft,
  type ApplicantDraft,
  type ApplicantErrors,
  type ApplicantStep,
  type ValidationMode,
} from "@/lib/applicant-schema"
import { cn } from "@/lib/utils"

const STEP_META: Record<
  ApplicantStep,
  { label: string; hint: string; icon: React.ElementType }
> = {
  applicant: {
    label: "Applicant",
    hint: "Identity and KYC",
    icon: UserRound,
  },
  communication: {
    label: "Communication",
    hint: "Address and contact",
    icon: MapPin,
  },
  business: {
    label: "Occupation",
    hint: "Income and employment",
    icon: Briefcase,
  },
  introducer: {
    label: "Introducer & nominee",
    hint: "References",
    icon: Users2,
  },
}

/** Two-column field grid that collapses to one column on small screens. */
function Grid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid gap-x-5 gap-y-4 sm:grid-cols-2", className)}>
      {children}
    </div>
  )
}

/** Heading for a group of related fields inside a step. */
function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  )
}

export default function ApplicantForm({
  branches,
  defaultBranch = "",
  applicant,
}: {
  /** Branches this admin may file an applicant against. */
  branches: string[]
  defaultBranch?: string
  /** A saved applicant to edit; without it the form enrols a new one. */
  applicant?: { id: number; code: string; draft: ApplicantDraft }
}) {
  const editing = Boolean(applicant)
  const mode: ValidationMode = editing ? "edit" : "create"
  const [draft, setDraft] = useState<ApplicantDraft>(
    () => applicant?.draft ?? emptyApplicant(defaultBranch || (branches.length === 1 ? branches[0] : ""))
  )
  const [step, setStep] = useState<ApplicantStep>("applicant")
  const [errors, setErrors] = useState<ApplicantErrors>({})
  // Steps the user has attempted to leave — only these show a red state, so a
  // step they have not reached yet is never marked as failing. An edit starts
  // with every step already filled in, so all of them count as visited.
  const [visited, setVisited] = useState<Set<ApplicantStep>>(
    new Set(editing ? APPLICANT_STEPS : ["applicant"])
  )
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedCode, setSavedCode] = useState("")
  const [submitError, setSubmitError] = useState("")

  const topRef = useRef<HTMLDivElement>(null)

  const stepIndex = APPLICANT_STEPS.indexOf(step)
  const isLastStep = stepIndex === APPLICANT_STEPS.length - 1

  const age = ageFrom(draft.dateOfBirth)
  const allErrors = useMemo(() => validateAll(draft, mode), [draft, mode])
  const outstanding = Object.keys(allErrors).length

  function set<K extends keyof ApplicantDraft>(key: K, value: ApplicantDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
    // Clear the error as soon as the field is touched; it is re-checked on Next.
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /** Numeric-only input helper for mobile, pincode and income fields. */
  function digitsOnly(value: string, maxLength: number) {
    return value.replace(/\D/g, "").slice(0, maxLength)
  }

  function addDocument() {
    setDraft((prev) => ({ ...prev, documents: [...prev.documents, emptyDocument()] }))
  }

  function removeDocument(index: number) {
    setDraft((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }))
    // Row messages are keyed by index, so they no longer line up once a row is
    // dropped. Clearing them is simpler than resequencing; Continue re-checks.
    setErrors((prev) => ({ ...prev, documentRows: undefined, documents: undefined }))
  }

  function setDocument(
    index: number,
    key: keyof ApplicantDocumentDraft,
    value: string
  ) {
    setDraft((prev) => ({
      ...prev,
      documents: prev.documents.map((doc, i) =>
        i === index ? { ...doc, [key]: value } : doc
      ),
    }))

    setErrors((prev) => {
      if (!prev.documentRows?.[index]) return prev
      const documentRows = { ...prev.documentRows }
      delete documentRows[index]
      return { ...prev, documentRows }
    })
  }

  function scrollToTop() {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function goTo(target: ApplicantStep) {
    const targetIndex = APPLICANT_STEPS.indexOf(target)

    // Moving forward validates the step being left; going back never blocks.
    if (targetIndex > stepIndex) {
      const stepErrors = validateStep(step, draft, mode)
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors)
        scrollToTop()
        return
      }
    }

    setErrors({})
    setVisited((prev) => new Set(prev).add(target))
    setStep(target)
    scrollToTop()
  }

  async function handleSubmit() {
    const found = validateAll(draft, mode)
    if (Object.keys(found).length > 0) {
      // Land the user on the first step that actually has a problem.
      const firstBad = APPLICANT_STEPS.find(
        (s) => Object.keys(validateStep(s, draft, mode)).length > 0
      )
      setErrors(validateStep(firstBad ?? "applicant", draft, mode))
      setVisited(new Set(APPLICANT_STEPS))
      if (firstBad) setStep(firstBad)
      scrollToTop()
      return
    }

    setSubmitting(true)
    setSubmitError("")

    const response = await fetch(applicant ? `/api/applicants/${applicant.id}` : "/api/applicants", {
      method: applicant ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        errors?: ApplicantErrors
        error?: string
      } | null

      // Server-side validation is the authority; surface it on the right step.
      if (payload?.errors && Object.keys(payload.errors).length > 0) {
        const firstBad = APPLICANT_STEPS.find((s) =>
          Object.keys(validateStep(s, draft, mode)).some((f) => f in payload.errors!)
        )
        setErrors(payload.errors)
        if (firstBad) setStep(firstBad)
      }

      setSubmitError(payload?.error ?? "Could not save this applicant.")
      setSubmitting(false)
      scrollToTop()
      return
    }

    const created = (await response.json()) as { applicantCode?: string }
    setSavedCode(created.applicantCode ?? "")
    setSubmitting(false)
    setSaved(true)
    scrollToTop()
  }

  function resetForm() {
    setDraft(emptyApplicant(defaultBranch || (branches.length === 1 ? branches[0] : "")))
    setErrors({})
    setVisited(new Set(["applicant"]))
    setStep("applicant")
    setSaved(false)
  }

  const fullName = [draft.firstName, draft.lastName].filter(Boolean).join(" ")

  if (saved && applicant) {
    return (
      <Card className="reveal-scale p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
          <CircleCheck className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold tracking-tight">Applicant updated</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Changes to {fullName || "the applicant"}{" "}
          <span className="tnum font-medium text-foreground">({applicant.code})</span> are saved.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/home/applicants">Back to applicant list</Link>
          </Button>
          <Button variant="outline" onClick={() => setSaved(false)}>
            Keep editing
          </Button>
        </div>
      </Card>
    )
  }

  if (saved) {
    return (
      <Card className="reveal-scale p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
          <CircleCheck className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold tracking-tight">Applicant enrolled</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {fullName || "The applicant"} has been recorded against the{" "}
          <span className="font-medium text-foreground">{draft.branch}</span> branch.
        </p>
        {savedCode && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5">
            <span className="text-xs text-muted-foreground">Applicant ID</span>
            <span className="tnum text-sm font-semibold">{savedCode}</span>
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={resetForm}>Add another applicant</Button>
          <Button variant="outline" asChild>
            <Link href="/home/applicants">View applicant list</Link>
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div ref={topRef} className="space-y-5 scroll-mt-24">
      {/* Stepper */}
      <Card className="reveal p-2" style={{ "--i": 1 } as React.CSSProperties}>
        <ol className="grid gap-1 sm:grid-cols-4">
          {APPLICANT_STEPS.map((id, index) => {
            const meta = STEP_META[id]
            const Icon = meta.icon
            const active = id === step
            const hasErrors =
              visited.has(id) && Object.keys(validateStep(id, draft, mode)).length > 0
            const complete = visited.has(id) && !hasErrors && index < stepIndex

            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => goTo(id)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "press flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    active ? "bg-brand-soft" : "hover:bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors",
                      active && "bg-brand text-brand-foreground shadow-brand",
                      !active &&
                        complete &&
                        "bg-success-soft text-success-soft-foreground",
                      !active &&
                        hasErrors &&
                        "bg-danger-soft text-danger-soft-foreground",
                      !active && !complete && !hasErrors && "bg-muted text-muted-foreground"
                    )}
                  >
                    {complete && !active ? (
                      <Check className="h-4 w-4" />
                    ) : hasErrors && !active ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-xs font-semibold",
                        active ? "text-brand-soft-foreground" : "text-foreground"
                      )}
                    >
                      {meta.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {meta.hint}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </Card>

      {/* Current step */}
      <Card className="reveal p-5 sm:p-6" style={{ "--i": 2 } as React.CSSProperties}>
        {step === "applicant" && (
          <div className="space-y-4">
            <Grid>
              <Field
                label="Mobile number *"
                error={errors.mobile}
                hint="Used for reminders and OTP verification"
              >
                <Input
                  inputMode="numeric"
                  value={draft.mobile}
                  onChange={(e) => set("mobile", digitsOnly(e.target.value, 10))}
                  placeholder="98765 43210"
                  autoComplete="tel-national"
                />
              </Field>

              <Field label="Applicant ID" hint="Assigned automatically once saved">
                <Input value="" placeholder="Auto-generated" disabled readOnly />
              </Field>

              <Field label="Branch *" error={errors.branch}>
                <Select
                  value={draft.branch}
                  onChange={(e) => set("branch", e.target.value)}
                >
                  <option value="">Select a branch</option>
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Sign date *" error={errors.signDate}>
                <Input
                  type="date"
                  value={draft.signDate}
                  onChange={(e) => set("signDate", e.target.value)}
                />
              </Field>

              <Field
                label="Chit value *"
                error={errors.chitValue}
                hint="The scheme value they are enrolling for"
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    inputMode="numeric"
                    value={draft.chitValue}
                    onChange={(e) => set("chitValue", digitsOnly(e.target.value, 9))}
                    placeholder="1,00,000"
                    className="pl-7"
                  />
                </div>
              </Field>

              <Field label="First name *" error={errors.firstName}>
                <Input
                  value={draft.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  placeholder="Priya"
                  autoComplete="given-name"
                />
              </Field>

              <Field label="Last name" error={errors.lastName}>
                <Input
                  value={draft.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  placeholder="Raman"
                  autoComplete="family-name"
                />
              </Field>

              <Field
                label="Date of birth *"
                error={errors.dateOfBirth}
                hint={age === null ? "Applicant must be 18 or older" : undefined}
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={draft.dateOfBirth}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => set("dateOfBirth", e.target.value)}
                    className="flex-1"
                  />
                  {/* Age is derived, never typed, so the two cannot disagree. */}
                  {age !== null && (
                    <Badge tone={age >= 18 ? "brand" : "danger"} size="md">
                      {age} yrs
                    </Badge>
                  )}
                </div>
              </Field>

              {/* Gender and marital status sit side by side — both are short
                  pill groups, so a full row each wasted vertical space. */}
              <Field label="Gender">
                <ChoiceGroup
                  name="Gender"
                  options={GENDERS}
                  value={draft.gender}
                  onChange={(next) => set("gender", next)}
                />
              </Field>

              <Field label="Marital status">
                <ChoiceGroup
                  name="Marital status"
                  options={MARITAL_STATUSES}
                  value={draft.maritalStatus}
                  onChange={(next) => set("maritalStatus", next)}
                />
              </Field>
            </Grid>

            <GroupHeading>Identity documents</GroupHeading>

            <Field
              label="Aadhaar number"
              error={errors.aadhaarNumber}
              hint="Optional · 12 digits"
              className="sm:max-w-sm"
            >
              <Input
                inputMode="numeric"
                value={draft.aadhaarNumber}
                onChange={(e) => set("aadhaarNumber", digitsOnly(e.target.value, 12))}
                placeholder="1234 5678 9012"
                autoComplete="off"
              />
            </Field>

            <div className="space-y-2">
              {draft.documents.map((doc, index) => (
                <div
                  key={index}
                  className="animate-scale-in flex flex-wrap items-start gap-2 sm:flex-nowrap"
                >
                  <Select
                    aria-label={`Document ${index + 1} type`}
                    value={doc.docType}
                    onChange={(e) => setDocument(index, "docType", e.target.value)}
                    wrapperClassName="w-full sm:w-52"
                  >
                    <option value="">Select a document</option>
                    {ID_DOCUMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>

                  <div className="min-w-0 flex-1">
                    <Input
                      aria-label={`Document ${index + 1} number`}
                      value={doc.docNumber}
                      onChange={(e) =>
                        setDocument(index, "docNumber", e.target.value.toUpperCase())
                      }
                      placeholder={
                        doc.docType ? `${doc.docType} number` : "Select a type first"
                      }
                      disabled={!doc.docType}
                    />
                    {errors.documentRows?.[index] && (
                      <p className="animate-fade-in mt-1.5 text-xs font-medium text-danger">
                        {errors.documentRows[index]}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove document ${index + 1}`}
                    onClick={() => removeDocument(index)}
                    className="shrink-0 hover:bg-danger-soft hover:text-danger-soft-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={addDocument}
                // Every available type is already on the form.
                disabled={draft.documents.length >= ID_DOCUMENT_TYPES.length}
              >
                <Plus className="h-3.5 w-3.5" />
                Add another document
              </Button>

              {draft.documents.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Optional: PAN, voter ID, passport and other proofs.
                </p>
              )}
            </div>
          </div>
        )}

        {step === "communication" && (
          <div className="space-y-4">
            <Grid>
              <Field label="Email" error={errors.email}>
                <Input
                  type="email"
                  value={draft.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="priya@example.com"
                  autoComplete="email"
                />
              </Field>

              <Field label="Alternate phone" error={errors.altPhone}>
                <Input
                  inputMode="numeric"
                  value={draft.altPhone}
                  onChange={(e) => set("altPhone", digitsOnly(e.target.value, 10))}
                  placeholder="98765 43210"
                />
              </Field>
            </Grid>

            <GroupHeading>Current address</GroupHeading>
            <Field label="Address line 1 *" error={errors.addressLine1}>
              <Input
                value={draft.addressLine1}
                onChange={(e) => set("addressLine1", e.target.value)}
                placeholder="Door no, street"
                autoComplete="address-line1"
              />
            </Field>

            <Field label="Address line 2">
              <Input
                value={draft.addressLine2}
                onChange={(e) => set("addressLine2", e.target.value)}
                placeholder="Area, landmark"
                autoComplete="address-line2"
              />
            </Field>

            <Grid className="sm:grid-cols-3">
              <Field label="Area *" error={errors.area}>
                <Input
                  value={draft.area}
                  onChange={(e) => set("area", e.target.value)}
                  placeholder="Nedungadu"
                />
              </Field>

              <Field label="City *" error={errors.city}>
                <Input
                  value={draft.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Coimbatore"
                  autoComplete="address-level2"
                />
              </Field>

              <Field label="State *" error={errors.state}>
                <Input
                  value={draft.state}
                  onChange={(e) => set("state", e.target.value)}
                  placeholder="Tamil Nadu"
                  autoComplete="address-level1"
                />
              </Field>

              <Field label="Pincode *" error={errors.pincode}>
                <Input
                  inputMode="numeric"
                  value={draft.pincode}
                  onChange={(e) => set("pincode", digitsOnly(e.target.value, 6))}
                  placeholder="641001"
                  autoComplete="postal-code"
                />
              </Field>
            </Grid>

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3.5 py-3">
              <div className="min-w-0 pr-3">
                <p className="text-sm font-medium">Permanent address is the same</p>
                <p className="text-xs text-muted-foreground">
                  Turn this off to record a different permanent address.
                </p>
              </div>
              <Switch
                checked={draft.permanentSameAsCurrent}
                onCheckedChange={(next) => set("permanentSameAsCurrent", next)}
                label="Permanent address is the same"
              />
            </div>

            {!draft.permanentSameAsCurrent && (
              <Field
                label="Permanent address *"
                error={errors.permanentAddress}
                className="animate-scale-in"
              >
                <Textarea
                  rows={3}
                  value={draft.permanentAddress}
                  onChange={(e) => set("permanentAddress", e.target.value)}
                  placeholder="Full permanent address with pincode"
                />
              </Field>
            )}
          </div>
        )}

        {step === "business" && (
          <div className="space-y-4">
            <Field label="Occupation type *" error={errors.occupationType}>
              <ChoiceGroup
                name="Occupation type"
                options={OCCUPATION_TYPES}
                value={draft.occupationType}
                onChange={(next) => set("occupationType", next)}
              />
            </Field>

            <Grid>
              <Field
                label={
                  draft.occupationType === "Salaried" ? "Employer name" : "Business name"
                }
              >
                <Input
                  value={draft.employerName}
                  onChange={(e) => set("employerName", e.target.value)}
                  placeholder="Where they work"
                />
              </Field>

              <Field label="Nature of work">
                <Input
                  value={draft.natureOfBusiness}
                  onChange={(e) => set("natureOfBusiness", e.target.value)}
                  placeholder="Textiles, retail, IT…"
                />
              </Field>

              <Field
                label="Annual income"
                error={errors.annualIncome}
                hint="In rupees, before tax"
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₹
                  </span>
                  <Input
                    inputMode="numeric"
                    value={draft.annualIncome}
                    onChange={(e) => set("annualIncome", digitsOnly(e.target.value, 10))}
                    placeholder="4,80,000"
                    className="pl-7"
                  />
                </div>
              </Field>

              <Field label="Years in this occupation" error={errors.yearsInOccupation}>
                <Input
                  inputMode="numeric"
                  value={draft.yearsInOccupation}
                  onChange={(e) => set("yearsInOccupation", digitsOnly(e.target.value, 2))}
                  placeholder="6"
                />
              </Field>
            </Grid>
          </div>
        )}

        {step === "introducer" && (
          <div className="space-y-4">
            <GroupHeading>Introducer</GroupHeading>
            <Grid>
              <Field label="Introducer name" hint="An existing member who referred them">
                <Input
                  value={draft.introducerName}
                  onChange={(e) => set("introducerName", e.target.value)}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Introducer ID">
                <Input
                  value={draft.introducerId}
                  onChange={(e) => set("introducerId", e.target.value.toUpperCase())}
                  placeholder="Optional"
                />
              </Field>
            </Grid>

            <GroupHeading>Nominee</GroupHeading>
            <Grid>
              <Field label="Nominee name *" error={errors.nomineeName}>
                <Input
                  value={draft.nomineeName}
                  onChange={(e) => set("nomineeName", e.target.value)}
                  placeholder="Full name"
                />
              </Field>

              <Field label="Relationship *" error={errors.nomineeRelation}>
                <Select
                  value={draft.nomineeRelation}
                  onChange={(e) => set("nomineeRelation", e.target.value)}
                >
                  <option value="">Select a relationship</option>
                  {NOMINEE_RELATIONS.map((relation) => (
                    <option key={relation} value={relation}>
                      {relation}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Nominee date of birth" error={errors.nomineeDob}>
                <Input
                  type="date"
                  value={draft.nomineeDob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => set("nomineeDob", e.target.value)}
                />
              </Field>

              <Field label="Nominee mobile" error={errors.nomineeMobile}>
                <Input
                  inputMode="numeric"
                  value={draft.nomineeMobile}
                  onChange={(e) => set("nomineeMobile", digitsOnly(e.target.value, 10))}
                  placeholder="98765 43210"
                />
              </Field>
            </Grid>

            {/* Pre-submit summary, so the last step is not a leap of faith. */}
            <div className="mt-2 rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Summary
                </p>
              </div>
              <dl className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2">
                {[
                  ["Name", fullName],
                  ["Mobile", draft.mobile],
                  ["Branch", draft.branch],
                  ["Age", age === null ? "" : `${age} years`],
                  [
                    "Chit value",
                    draft.chitValue ? `₹${Number(draft.chitValue).toLocaleString("en-IN")}` : "",
                  ],
                  ["Area", draft.area],
                  ["Occupation", draft.occupationType],
                  ["Nominee", draft.nomineeName],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd
                      className={cn(
                        "truncate text-right font-medium",
                        value ? "text-foreground" : "text-muted-foreground/60"
                      )}
                    >
                      {value || "Not set"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </Card>

      {submitError && (
        <p className="animate-scale-in flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {submitError}
        </p>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-card/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => goTo(APPLICANT_STEPS[stepIndex - 1])}
            disabled={stepIndex === 0 || submitting}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <p className="hidden text-xs text-muted-foreground sm:block">
            Step {stepIndex + 1} of {APPLICANT_STEPS.length}
            {isLastStep && outstanding > 0 && (
              <span className="ml-2 font-medium text-danger">
                · {outstanding} field{outstanding === 1 ? "" : "s"} need attention
              </span>
            )}
          </p>

          <div className="ml-auto flex items-center gap-2">
            {!isLastStep && (
              <Button
                variant={editing ? "outline" : "default"}
                onClick={() => goTo(APPLICANT_STEPS[stepIndex + 1])}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {/* An edit is usually one field, so it can be saved from any step. */}
            {(isLastStep || editing) && (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {submitting ? "Saving…" : editing ? "Save changes" : "Save applicant"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
