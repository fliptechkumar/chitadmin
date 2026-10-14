"use client"

import { useState } from "react"
import { KeyRound, ShieldCheck } from "lucide-react"

import ChangePasswordDialog from "./change-password-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Password management on the account page. This is the only place the USER
 * role can reach it — they never see the admin header.
 */
export default function SecurityCard() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card className="reveal" style={{ "--i": 3 } as React.CSSProperties}>
        <CardContent className="flex flex-wrap items-center gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Password</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Change it here. Other devices are signed out when you do.
            </p>
          </div>
          <Button variant="outline" onClick={() => setOpen(true)}>
            <KeyRound className="h-4 w-4" />
            Change password
          </Button>
        </CardContent>
      </Card>

      <ChangePasswordDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
