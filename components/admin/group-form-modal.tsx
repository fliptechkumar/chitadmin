"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import Modal from "./modal"
import { Button } from "@/components/ui/button"
import { Field, Input, Select } from "@/components/ui/input"
import type { ChitGroup } from "@/lib/mock-data"
import {
  GROUP_STATUSES,
  PERCENTAGE_OPTIONS,
  SPECIAL_TYPES,
  parseGroupInput,
  toDisplayDate,
  toInputDate,
  type GroupErrors,
} from "@/lib/group-schema"

type FormState = {
  branchName: string
  specialType: string
  group: string
  percentage: string
  amount: string
  startDate: string
  endDate: string
  totalTickets: string
  status: ChitGroup["status"]
}

/** Seats a group opens with unless the form says otherwise. */
const DEFAULT_SEATS = "20"

const EMPTY_FORM: FormState = {
  branchName: "",
  specialType: SPECIAL_TYPES[0],
  group: "",
  percentage: "",
  amount: "",
  startDate: "",
  endDate: "",
  totalTickets: DEFAULT_SEATS,
  status: "active",
}

function toFormState(group: ChitGroup): FormState {
  return {
    branchName: group.branchName,
    specialType: group.specialType,
    group: group.group,
    // A group written before this list existed can hold a percentage that is
    // no longer offered; blank it so the edit has to pick a current one.
    percentage: PERCENTAGE_OPTIONS.includes(group.percentage) ? group.percentage : "",
    amount: String(group.amount),
    startDate: toInputDate(group.startDate),
    endDate: toInputDate(group.endDate),
    totalTickets: String(group.totalTickets),
    status: group.status,
  }
}

type Props = {
  open: boolean
  /** Group being edited, or null when creating a new one. */
  group: ChitGroup | null
  branches: string[]
  onClose: () => void
  onSaved: (group: ChitGroup) => void
}

export default function GroupFormModal({
  open,
  group,
  branches,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<GroupErrors>({})
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  // Reset the fields every time the modal is opened for a different row.
  useEffect(() => {
    if (!open) return
    setForm(group ? toFormState(group) : EMPTY_FORM)
    setErrors({})
    setFormError("")
  }, [open, group])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      ...form,
      amount: form.amount === "" ? "" : Number(form.amount),
      totalTickets: form.totalTickets === "" ? "" : Number(form.totalTickets),
      startDate: toDisplayDate(form.startDate),
      endDate: toDisplayDate(form.endDate),
    }

    const parsed = parseGroupInput(payload)
    if (!parsed.ok) {
      setErrors(parsed.errors)
      return
    }

    setSaving(true)
    setFormError("")
    try {
      const res = await fetch(group ? `/api/groups/${group.id}` : "/api/groups", {
        method: group ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        if (body?.errors) setErrors(body.errors)
        setFormError("Could not save the group. Check the fields and try again.")
        return
      }

      onSaved(await res.json())
    } catch {
      setFormError("Network error — the group was not saved.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={group ? "Edit chit group" : "Add chit group"}
      description={
        group
          ? `Updating ${group.group}`
          : "Create a new chit group and its schedule."
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="group-form" size="sm" disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {group ? "Save changes" : "Create group"}
          </Button>
        </>
      }
    >
      <form id="group-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Branch" error={errors.branchName}>
          <Input
            list="branch-options"
            value={form.branchName}
            onChange={(e) => set("branchName", e.target.value)}
            placeholder="KovilPatti"
          />
          <datalist id="branch-options">
            {branches.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>

        <Field label="Type" error={errors.specialType}>
          <Select
            value={form.specialType}
            onChange={(e) => set("specialType", e.target.value)}
          >
            {SPECIAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Group name" error={errors.group}>
          <Input
            value={form.group}
            onChange={(e) => set("group", e.target.value.toUpperCase())}
            placeholder="MIKEE18"
          />
        </Field>

        <Field label="Percentage" error={errors.percentage}>
          <Select
            value={form.percentage}
            onChange={(e) => set("percentage", e.target.value)}
          >
            <option value="" disabled>
              Select percentage
            </option>
            {PERCENTAGE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Amount (₹)" error={errors.amount}>
          <Input
            type="number"
            min={1}
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            placeholder="100000"
          />
        </Field>

        <Field label="Status" error={errors.status}>
          <Select
            value={form.status}
            onChange={(e) => set("status", e.target.value as ChitGroup["status"])}
            className="capitalize"
          >
            {GROUP_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Start date" error={errors.startDate}>
          <Input
            type="date"
            value={form.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </Field>

        <Field label="End date" error={errors.endDate}>
          <Input
            type="date"
            value={form.endDate}
            onChange={(e) => set("endDate", e.target.value)}
          />
        </Field>

        {/* Seats, not members: the roster is created to this size and the
            members/vacants columns are counted off it as seats are filled. */}
        <Field
          label="Seats (tickets)"
          error={errors.totalTickets}
          hint={
            group
              ? "Seats can only be dropped while they are empty."
              : "Seat 1 is the company's own; the rest open vacant."
          }
        >
          <Input
            type="number"
            min={2}
            value={form.totalTickets}
            onChange={(e) => set("totalTickets", e.target.value)}
            placeholder={DEFAULT_SEATS}
          />
        </Field>

        {formError && (
          <p className="animate-fade-in flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger-soft-foreground sm:col-span-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {formError}
          </p>
        )}
      </form>
    </Modal>
  )
}
