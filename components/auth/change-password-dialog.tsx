"use client"

import { useState } from "react"
import { AlertCircle, Check, CircleCheck, Eye, EyeOff, Loader2, X } from "lucide-react"

import Modal from "@/components/admin/modal"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { passwordChecks } from "@/lib/password-rules"
import { cn } from "@/lib/utils"

type Errors = Partial<
  Record<"currentPassword" | "newPassword" | "confirmPassword" | "form", string>
>

/** Password input with its own show/hide toggle. */
function SecretInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
  autoComplete: string
  autoFocus?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="press absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export default function ChangePasswordDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ signedOutElsewhere: number } | null>(null)
  const [wasOpen, setWasOpen] = useState(false)

  // Clear on each opening, derived during render so nothing leaks between uses.
  if (open && !wasOpen) {
    setWasOpen(true)
    setCurrent("")
    setNext("")
    setConfirm("")
    setErrors({})
    setDone(null)
  }
  if (!open && wasOpen) setWasOpen(false)

  const checks = passwordChecks(next)
  const matches = next.length > 0 && next === confirm

  async function handleSubmit() {
    setSaving(true)
    setErrors({})

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      }),
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        errors?: Errors
      } | null
      setErrors(body?.errors ?? { form: "Could not change your password." })
      setSaving(false)
      return
    }

    const result = (await response.json()) as { signedOutElsewhere: number }
    setSaving(false)
    setDone(result)
  }

  if (done) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Password changed"
        size="sm"
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success-soft-foreground">
            <CircleCheck className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium">Your password has been updated.</p>
          <p className="text-xs text-muted-foreground">
            {done.signedOutElsewhere > 0
              ? `You have been signed out of ${done.signedOutElsewhere} other session${
                  done.signedOutElsewhere === 1 ? "" : "s"
                }. This one stays active.`
              : "You are still signed in here."}
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change password"
      description="You will stay signed in here; other devices are signed out."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !current || !matches || checks.some((c) => !c.met)}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
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

        <Field label="Current password" error={errors.currentPassword}>
          <SecretInput
            value={current}
            onChange={setCurrent}
            placeholder="Your existing password"
            autoComplete="current-password"
            autoFocus
          />
        </Field>

        <Field label="New password" error={errors.newPassword}>
          <SecretInput
            value={next}
            onChange={setNext}
            placeholder="Choose a new password"
            autoComplete="new-password"
          />
        </Field>

        {/* Shown as it is typed, rather than revealing one failure per submit. */}
        {next.length > 0 && (
          <ul className="animate-fade-in space-y-1">
            {checks.map((check) => (
              <li
                key={check.label}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  check.met ? "text-success-soft-foreground" : "text-muted-foreground"
                )}
              >
                {check.met ? (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <X className="h-3.5 w-3.5 shrink-0 opacity-50" />
                )}
                {check.label}
              </li>
            ))}
          </ul>
        )}

        <Field label="Confirm new password" error={errors.confirmPassword}>
          <SecretInput
            value={confirm}
            onChange={setConfirm}
            placeholder="Type it again"
            autoComplete="new-password"
          />
        </Field>

        {confirm.length > 0 && !matches && !errors.confirmPassword && (
          <p className="flex items-center gap-1.5 text-xs text-danger">
            <X className="h-3.5 w-3.5 shrink-0" />
            Passwords do not match
          </p>
        )}
      </div>
    </Modal>
  )
}
