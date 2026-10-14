import { Suspense } from "react"

import AuthLayout from "@/components/auth/auth-layout"
import LoginForm from "@/components/auth/login-form"
import { getCompany } from "@/lib/company"

/**
 * Server component so the sign-in screen carries the company's own branding
 * before anyone has authenticated. The form itself is a client component.
 */
export default async function LoginPage() {
  const company = await getCompany()

  return (
    <AuthLayout
      company={company}
      eyebrow="Admin portal"
      title="Sign in"
      subtitle="Enter the credentials issued by your administrator."
      footer={
        <p className="text-sm text-muted-foreground">
          Need an account? Contact your Super Admin — accounts are created for you.
        </p>
      }
    >
      {/* useSearchParams needs a Suspense boundary to keep the page prerenderable. */}
      <Suspense fallback={<div className="h-64" />}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  )
}
