"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  MapPinned,
  Monitor,
  Moon,
  Palette,
  Save,
  Sun,
  Upload,
  Users,
} from "lucide-react"

import MemberImportSettings from "@/components/admin/member-import-settings"
import RoutesSettings from "@/components/admin/routes-settings"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, Input, Textarea } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ALLOWED_LOGO_TYPES,
  COMPANY_DEFAULTS,
  MAX_LOGO_BYTES,
  type CompanyErrors,
  type CompanyProfile,
} from "@/lib/company-schema"
import { useIsMounted } from "@/lib/use-is-mounted"
import { cn } from "@/lib/utils"

type SectionId =
  | "company"
  | "routes"
  | "members"
  | "users"
  | "theme"

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: "company", label: "Company", icon: <Building2 className="h-4 w-4" /> },
  { id: "routes", label: "Routes", icon: <MapPinned className="h-4 w-4" /> },
  { id: "members", label: "Member import", icon: <FileSpreadsheet className="h-4 w-4" /> },
  { id: "users", label: "User management", icon: <Users className="h-4 w-4" /> },
  { id: "theme", label: "Appearance", icon: <Palette className="h-4 w-4" /> },
]

/** Confirmation banner that clears itself. */
function useSaveFlag(ms = 2600) {
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function flag() {
    setSaved(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setSaved(false), ms)
  }

  return [saved, flag] as const
}

function SaveBanner({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="animate-scale-in flex items-center gap-2 rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm font-medium text-success-soft-foreground">
      <CheckCircle2 className="h-4 w-4" />
      Settings saved successfully.
    </div>
  )
}

function SaveButton({ onClick, label = "Save changes" }: { onClick: () => void; label?: string }) {
  return (
    <Button onClick={onClick} size="sm">
      <Save className="h-3.5 w-3.5" />
      {label}
    </Button>
  )
}

const COMPANY_FIELDS: { label: string; key: keyof CompanyProfile }[] = [
  { label: "Company name *", key: "name" },
  { label: "Short name *", key: "shortName" },
  { label: "Registration no.", key: "regNo" },
  { label: "GST no.", key: "gst" },
  { label: "Phone", key: "phone" },
  { label: "Email", key: "email" },
  { label: "Website", key: "website" },
  { label: "City", key: "city" },
  { label: "State", key: "state" },
  { label: "Pincode", key: "pincode" },
]

function CompanySettings() {
  const router = useRouter()
  const [saved, flag] = useSaveFlag()
  const [form, setForm] = useState<CompanyProfile>(COMPANY_DEFAULTS)
  const [errors, setErrors] = useState<CompanyErrors>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState("")
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true

    fetch("/api/settings/company")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: CompanyProfile) => {
        if (active) setForm(data)
      })
      .catch(() => {
        if (active) setLoadError("Could not load company settings.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  function set<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleLogoFile(file: File | undefined) {
    if (!file) return

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, logo: "Use a PNG, JPEG, WebP or SVG image" }))
      return
    }

    // Checked before reading: base64 inflates by a third, so an oversized file
    // would otherwise be held in memory only to be rejected.
    if (file.size > MAX_LOGO_BYTES) {
      setErrors((prev) => ({
        ...prev,
        logo: `Logo must be under ${Math.round(MAX_LOGO_BYTES / 1024)}KB`,
      }))
      return
    }

    const reader = new FileReader()
    reader.onload = () => set("logo", String(reader.result))
    reader.onerror = () =>
      setErrors((prev) => ({ ...prev, logo: "Could not read that file" }))
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    setSaving(true)
    setErrors({})

    const response = await fetch("/api/settings/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        errors?: CompanyErrors
      } | null
      setErrors(body?.errors ?? { name: "Could not save these settings." })
      setSaving(false)
      return
    }

    setForm((await response.json()) as CompanyProfile)
    setSaving(false)
    flag()
    // Branding is server-rendered in the sidebar, so refresh to pick it up.
    router.refresh()
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SaveBanner show={saved} />

      {loadError && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          {loadError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Shown in the sidebar and printed on receipts. PNG, JPEG, WebP or SVG,
            under {Math.round(MAX_LOGO_BYTES / 1024)}KB.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-2">
            {form.logo ? (
              /* Data URI from the database, so next/image would add nothing. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.logo}
                alt="Company logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <ImageIcon className="h-7 w-7 text-muted-foreground" />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept={ALLOWED_LOGO_TYPES.join(",")}
                className="hidden"
                onChange={(e) => handleLogoFile(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {form.logo ? "Replace logo" : "Upload logo"}
              </Button>
              {form.logo && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    set("logo", "")
                    if (logoInputRef.current) logoInputRef.current.value = ""
                  }}
                  className="hover:bg-danger-soft hover:text-danger-soft-foreground"
                >
                  Remove
                </Button>
              )}
            </div>
            {errors.logo && (
              <p className="text-xs font-medium text-danger">{errors.logo}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {COMPANY_FIELDS.map(({ label, key }, i) => (
          <div key={key} style={{ "--i": i } as React.CSSProperties} className="reveal-fade">
            <Field
              label={label}
              error={errors[key]}
              hint={key === "shortName" ? "Appears in the sidebar and page chrome" : undefined}
            >
              <Input
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </Field>
          </div>
        ))}
        <Field label="Address" error={errors.addressLine} className="sm:col-span-2">
          <Textarea
            rows={2}
            value={form.addressLine}
            onChange={(e) => set("addressLine", e.target.value)}
          />
        </Field>
      </div>

      <Button onClick={handleSave} size="sm" disabled={saving}>
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  )
}

const THEME_MODES = [
  { id: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
  { id: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
  { id: "system", label: "System", icon: <Monitor className="h-4 w-4" /> },
]

function ThemeSettings() {
  const [saved, flag] = useSaveFlag()
  const { theme, setTheme } = useTheme()
  const mounted = useIsMounted()
  const [primaryColor, setPrimaryColor] = useState("#2563eb")
  const [accentColor, setAccentColor] = useState("#10b981")
  const [logoText, setLogoText] = useState("ChitAdmin")

  return (
    <div className="space-y-4">
      <SaveBanner show={saved} />

      <Card>
        <CardHeader>
          <CardTitle>Theme mode</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {THEME_MODES.map((mode) => {
            const active = mounted && theme === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTheme(mode.id)}
                className={cn(
                  "press flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium",
                  active
                    ? "border-brand bg-brand text-brand-foreground shadow-brand"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {mode.icon}
                {mode.label}
              </button>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Brand colours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Primary", value: primaryColor, set: setPrimaryColor },
              { label: "Accent", value: accentColor, set: setAccentColor },
            ].map(({ label, value, set }) => (
              <label key={label} className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-muted-foreground">
                  {label}
                </span>
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="h-8 w-14 cursor-pointer rounded border border-border bg-card p-0.5"
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {value}
                  </span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="App / logo text">
              <Input
                value={logoText}
                onChange={(e) => setLogoText(e.target.value)}
              />
            </Field>
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Preview
              </span>
              <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-4 py-3">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white transition-colors duration-300"
                  style={{ backgroundColor: primaryColor }}
                >
                  ₹
                </span>
                <span className="text-sm font-bold text-foreground">
                  {logoText || "ChitAdmin"}
                </span>
                <span
                  className="ml-auto h-2 w-2 rounded-full transition-colors duration-300"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: press{" "}
        <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
          D
        </kbd>{" "}
        anywhere to flip between dark and light.
      </p>

      <SaveButton onClick={flag} label="Save appearance" />
    </div>
  )
}

export default function SettingsView({
  userManagement,
}: {
  /** Rendered on the server, since the account list comes from the database. */
  userManagement: React.ReactNode
}) {
  const [section, setSection] = useState<SectionId>("company")

  const views: Record<SectionId, React.ReactNode> = {
    company: <CompanySettings />,
    routes: <RoutesSettings />,
    members: <MemberImportSettings />,
    users: userManagement,
    theme: <ThemeSettings />,
  }

  const current = SECTIONS.find((s) => s.id === section)

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
      {/* Desktop rail */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <Card className="reveal sticky top-24 p-2">
          {SECTIONS.map(({ id, label, icon }, i) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              style={{ "--i": i } as React.CSSProperties}
              className={cn(
                "reveal-left press flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium",
                section === id
                  ? "bg-brand text-brand-foreground shadow-brand"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </Card>
      </aside>

      {/* Mobile rail */}
      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
        {SECTIONS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={cn(
              "press flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold",
              section === id
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <Card className="reveal min-w-0 flex-1 p-5" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className="mb-5 text-base font-semibold tracking-tight">
          {current?.label}
        </h2>
        <div key={section} className="animate-fade-up">
          {views[section]}
        </div>
      </Card>
    </div>
  )
}
