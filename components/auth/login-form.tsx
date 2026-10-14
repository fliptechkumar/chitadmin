"use client"

import { useSearchParams } from "next/navigation"
import { useState, type FormEvent } from "react"
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { loginUser } from "@/lib/auth"

export default function LoginForm() {
  const searchParams = useSearchParams()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    const inputUsername = username.trim()
    const inputPassword = password.trim()

    if (!inputUsername || !inputPassword) {
      setError("Please enter both username and password.")
      return
    }

    setIsLoading(true)
    const result = await loginUser(inputUsername, inputPassword)

    if (!result.ok) {
      setError(result.message)
      setIsLoading(false)
      return
    }

    // Prefer where they were headed before the redirect to login, but only when
    // it is a same-site path — an absolute URL here would be an open redirect.
    const next = searchParams.get("next")
    const target = next?.startsWith("/") && !next.startsWith("//") ? next : result.redirectTo

    // Full navigation so the server re-renders with the new session cookie.
    window.location.href = target
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="reveal" style={{ "--i": 1 } as React.CSSProperties}>
        <Field label="Username">
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="your username"
            autoFocus
            className="h-10"
          />
        </Field>
      </div>

      <div className="reveal" style={{ "--i": 2 } as React.CSSProperties}>
        <Field label="Password">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="press absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </Field>
      </div>

      {error && (
        <p className="animate-scale-in flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {isLoading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
