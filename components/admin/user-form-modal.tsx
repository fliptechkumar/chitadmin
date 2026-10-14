"use client"

import { useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import Modal from "./modal"
import { Button } from "@/components/ui/button"
import { Field, Input, Select } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ROLE_LABELS, type Role } from "@/lib/roles"
import type { UserErrors } from "@/lib/user-schema"
import { cn } from "@/lib/utils"

export type ManagedUser = {
  id: number
  username: string
  email: string
  name: string
  role: Role
  branches: string[]
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

type FormState = {
  username: string
  email: string
  name: string
  password: string
  role: Role
  branches: string[]
  isActive: boolean
}

const EMPTY: FormState = {
  username: "",
  email: "",
  name: "",
  password: "",
  role: "USER",
  branches: [],
  isActive: true,
}

export default function UserFormModal({
  open,
  editing,
  allowedRoles,
  branchOptions,
  onClose,
  onSaved,
}: {
  open: boolean
  /** The row being edited, or null when creating. */
  editing: ManagedUser | null
  /** Roles the signed-in admin may assign — narrower for a Chit Admin. */
  allowedRoles: Role[]
  /** Branches the signed-in admin may hand out. */
  branchOptions: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<UserErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Reset whenever the modal opens so a previous edit never leaks into the next.
  // Derived during render rather than in an effect, so the first paint already
  // shows the right values instead of flashing the previous ones.
  const openKey = open ? String(editing?.id ?? "new") : null

  if (openKey !== null && openKey !== loadedFor) {
    setLoadedFor(openKey)
    setErrors({})
    setForm(
      editing
        ? {
            username: editing.username,
            email: editing.email,
            name: editing.name,
            password: "",
            role: editing.role,
            branches: editing.branches,
            isActive: editing.isActive,
          }
        : {
            ...EMPTY,
            role: allowedRoles[0] ?? "USER",
            // With a single branch available (a Chit Admin creating a user)
            // there is nothing to choose, so preselect it.
            branches: branchOptions.length === 1 ? branchOptions : [],
          }
    )
  }

  // Allow the next open to re-initialise.
  if (openKey === null && loadedFor !== null) setLoadedFor(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function toggleBranch(branch: string) {
    set(
      "branches",
      form.branches.includes(branch)
        ? form.branches.filter((b) => b !== branch)
        : [...form.branches, branch]
    )
  }

  async function handleSubmit() {
    setSubmitting(true)
    setErrors({})

    const url = editing ? `/api/users/${editing.id}` : "/api/users"
    const method = editing ? "PATCH" : "POST"

    // On edit an empty password field means "keep the current one".
    const payload: Record<string, unknown> = {
      email: form.email,
      name: form.name,
      role: form.role,
      branches: form.branches,
      isActive: form.isActive,
      password: form.password,
    }
    if (!editing) payload.username = form.username

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        errors?: UserErrors
        error?: string
      } | null
      setErrors(body?.errors ?? { form: body?.error ?? "Could not save this user." })
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onSaved()
  }

  // Super Admins are unscoped; every other role is tied to specific branches.
  const showBranches = form.role !== "SUPER_ADMIN"

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.username}` : "Add user"}
      description={
        editing
          ? "Changing the role, branches, password or status signs this user out everywhere."
          : "The account can be used as soon as you save it."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create user"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errors.form && (
          <p className="animate-scale-in flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.form}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errors.name}>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Priya Raman"
            />
          </Field>

          <Field
            label="Username"
            error={errors.username}
            hint={editing ? "Usernames cannot be changed" : "Lowercase, 3-32 characters"}
          >
            <Input
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              placeholder="priya.raman"
              disabled={Boolean(editing)}
              autoComplete="off"
            />
          </Field>
        </div>

        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="priya@example.com"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role" error={errors.role}>
            <Select
              value={form.role}
              onChange={(e) => set("role", e.target.value as Role)}
            >
              {allowedRoles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={editing ? "New password" : "Password"}
            error={errors.password}
            hint={
              editing
                ? "Leave blank to keep the current password"
                : "At least 8 characters, with a letter and a number"
            }
          >
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={editing ? "••••••••" : "Set a password"}
              autoComplete="new-password"
            />
          </Field>
        </div>

        {showBranches && (
          <Field
            label="Branches"
            error={errors.branches}
            hint={
              form.role === "CHIT_ADMIN"
                ? "A Chit Admin can only see and act on the branches selected here"
                : "Determines which Chit Admins can manage this user"
            }
          >
            {branchOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No branches exist yet — create a chit group first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {branchOptions.map((branch) => {
                  const selected = form.branches.includes(branch)
                  return (
                    <button
                      key={branch}
                      type="button"
                      onClick={() => toggleBranch(branch)}
                      aria-pressed={selected}
                      className={cn(
                        "press rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        selected
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-border bg-surface-2 text-muted-foreground hover:border-brand/40 hover:text-foreground"
                      )}
                    >
                      {branch}
                    </button>
                  )
                })}
              </div>
            )}
          </Field>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Account active</p>
            <p className="text-xs text-muted-foreground">
              Disabled accounts cannot sign in and are signed out immediately.
            </p>
          </div>
          <Switch
            checked={form.isActive}
            onCheckedChange={(next) => set("isActive", next)}
            label="Account active"
          />
        </div>
      </div>
    </Modal>
  )
}
