import Link from "next/link"
import { Clock, LayoutDashboard, Mail, UserRound } from "lucide-react"

import SecurityCard from "@/components/auth/security-card"
import SignOutButton from "@/components/auth/sign-out-button"
import { CompanyMark } from "@/components/company-mark"
import { getCompany } from "@/lib/company"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireUser } from "@/lib/auth-server"
import { ROLE_LABELS } from "@/lib/roles"

export const metadata = { title: "Your account" }

export const dynamic = "force-dynamic"

/**
 * Landing page for the User role. Self-service chit features (statements, dues,
 * receipts) are not built yet, so this confirms the session and shows the
 * account details rather than exposing anything from the admin area.
 */
export default async function AccountPage() {
  const user = await requireUser()
  const company = await getCompany()
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "CHIT_ADMIN"

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <CompanyMark company={company} className="h-14 w-14" iconClassName="h-6 w-6" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-tight">{company.shortName}</p>
          <p className="text-xs text-muted-foreground">{company.name}</p>
        </div>
        <SignOutButton />
      </div>

      <Card className="reveal" style={{ "--i": 1 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <Badge tone="success" dot>
            active
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold uppercase text-brand-foreground">
              {user.username.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {user.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
          </div>

          <dl className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Username
                </dt>
                <dd className="truncate text-sm">{user.username}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Email
                </dt>
                <dd className="truncate text-sm">{user.email}</dd>
              </div>
            </div>
          </dl>
        </CardContent>
      </Card>

      <SecurityCard />

      <Card className="reveal" style={{ "--i": 4 } as React.CSSProperties}>
        <CardContent className="flex items-start gap-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Self-service is on the way</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your chit groups, payment history and dues will appear here. Until
              then, contact your branch for statements and receipts.
            </p>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="reveal" style={{ "--i": 3 } as React.CSSProperties}>
          <Button variant="outline" asChild>
            <Link href="/home">
              <LayoutDashboard className="h-4 w-4" />
              Go to the admin dashboard
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
