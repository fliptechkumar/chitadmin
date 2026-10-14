"use client"

import { useState } from "react"
import { Loader2, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { logoutUser } from "@/lib/auth"

export default function SignOutButton({
  variant = "outline",
}: {
  variant?: "outline" | "ghost" | "default"
}) {
  const [busy, setBusy] = useState(false)

  return (
    <Button
      variant={variant}
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await logoutUser()
      }}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  )
}
