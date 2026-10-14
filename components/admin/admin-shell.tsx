"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import {
  Bell,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  LogOut,
  Menu,
  Moon,
  KeyRound,
  Search,
  Sun,
  UserRound,
  X,
} from "lucide-react"

import CommandPalette from "./command-palette"
import { activeNavHref, navSectionsFor, NAV_LABELS, type NavItem } from "./nav"
import ChangePasswordDialog from "@/components/auth/change-password-dialog"
import { CompanyMark } from "@/components/company-mark"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CompanyProfile } from "@/lib/company-schema"
import { logoutUser, type SessionUser } from "@/lib/auth"
import { ROLE_LABELS } from "@/lib/roles"
import { useIsMounted } from "@/lib/use-is-mounted"
import { cn } from "@/lib/utils"

const COLLAPSED_KEY = "sidebar_collapsed"

function breadcrumbsFor(pathname: string) {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((segment, i, all) => {
      const href = "/" + all.slice(0, i + 1).join("/")
      const words = segment.replace(/-/g, " ")
      return {
        label: NAV_LABELS.get(href) ?? words.charAt(0).toUpperCase() + words.slice(1),
        href,
      }
    })
}

export default function AdminShell({
  children,
  user,
  company,
}: {
  children: React.ReactNode
  /** Resolved server-side in app/home/layout.tsx — never trusted from the client. */
  user: SessionUser
  /** Branding from the database, so Settings changes show up here. */
  company: CompanyProfile
}) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()

  const mounted = useIsMounted()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  /** Groups the user has opened or closed by hand; otherwise a group is open
   *  exactly when it holds the current page. */
  const [groupOverride, setGroupOverride] = useState<Record<string, boolean>>({})

  const navRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null)
  const [pillReady, setPillReady] = useState(false)

  const username = user.username

  // Only the persisted chrome state lives in the browser, so it is read after
  // hydration — the server render stays deterministic.
  const collapsed =
    collapsedOverride ?? (mounted && localStorage.getItem(COLLAPSED_KEY) === "true")

  // The sidebar shows only what this role may reach. This is presentation, not
  // enforcement: middleware rejects a hand-typed URL regardless.
  const sections = navSectionsFor(user.role)

  /** Row count preceding each section, so the reveal stagger runs top to bottom. */
  const navOffsets = sections.reduce<number[]>(
    (acc, section) => [...acc, acc[acc.length - 1] + section.items.length],
    [0]
  )

  const activeHref = activeNavHref(pathname)

  const groupHasActive = (item: NavItem) =>
    Boolean(item.children?.some((c) => c.href === activeHref))
  const isGroupOpen = (item: NavItem) =>
    groupOverride[item.href] ?? groupHasActive(item)
  const openGroupsKey = sections
    .flatMap((s) => s.items)
    .filter((item) => item.children && isGroupOpen(item))
    .map((item) => item.href)
    .join(",")
  const breadcrumbs = breadcrumbsFor(pathname)
  const pageTitle = breadcrumbs[breadcrumbs.length - 1]?.label ?? "Dashboard"
  const isDark = resolvedTheme === "dark"

  // Slide the highlight to whichever nav row is active.
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return

    const measure = () => {
      const active = nav.querySelector<HTMLElement>('[data-active="true"]')
      if (!active) return setPill(null)

      // Every row sits in a `relative` <li> (it anchors the collapsed tooltip),
      // so the link's own offsetTop is 0. Walk the offset chain up to the nav
      // box to get the row's real position inside the scroll container.
      let top = 0
      let node: HTMLElement | null = active
      while (node && node !== nav) {
        top += node.offsetTop
        node = node.offsetParent as HTMLElement | null
      }

      setPill({ top, height: active.offsetHeight })
      setPillReady(true)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    // A group opening or closing moves the rows below it; measure again once
    // its height transition has settled.
    const settle = setTimeout(measure, 320)
    return () => {
      observer.disconnect()
      clearTimeout(settle)
    }
  }, [activeHref, collapsed, username, openGroupsKey])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsedOverride((prev) => {
      const next = !(prev ?? localStorage.getItem(COLLAPSED_KEY) === "true")
      localStorage.setItem(COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    // Redirects on completion; the session row is deleted server-side first.
    await logoutUser()
  }

  const initials = username.slice(0, 2)

  return (
    <div className="min-h-svh bg-background">
      {/* Mobile scrim */}
      {sidebarOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-30 bg-foreground/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-300 ease-out-expo lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-[72px]" : "w-[264px]"
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            // Taller than a standard bar so an uploaded logo — often a circular
            // badge with lettering inside — is legible rather than a smudge.
            "flex h-20 shrink-0 items-center border-b border-sidebar-border transition-all duration-300",
            collapsed ? "justify-center px-0" : "gap-3 px-4"
          )}
        >
          <CompanyMark
            company={company}
            className={cn(
              "transition-[height,width] duration-300",
              collapsed ? "h-12 w-12" : "h-14 w-14"
            )}
            iconClassName="h-6 w-6"
          />
          {!collapsed && (
            <div className="animate-fade-in min-w-0 flex-1">
              <p className="truncate text-sm font-bold tracking-tight text-sidebar-accent-foreground">
                {company.shortName}
              </p>
              <p className="truncate text-2xs text-muted-foreground">
                {company.name}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="press rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div
          ref={navRef}
          className={cn(
            "hide-scrollbar relative flex-1 px-3 py-4",
            // Collapsed, the rail's tooltips and flyouts hang outside it; a
            // scroll container would clip them. The icon rail fits unscrolled.
            collapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"
          )}
        >
          {pill && (
            <span
              aria-hidden
              className={cn(
                "absolute left-3 right-3 top-0 rounded-lg bg-brand shadow-brand",
                // Only animate once it has been placed, otherwise it slides in
                // from the top of the nav on first paint.
                pillReady && "transition-[transform,height] duration-300 ease-out-expo"
              )}
              style={{ transform: `translateY(${pill.top}px)`, height: pill.height }}
            />
          )}

          {sections.map((section, sectionIndex) => (
            <div key={section.title} className={cn(sectionIndex > 0 && "mt-5")}>
              {!collapsed && (
                <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item, i) => {
                  const { label, href, icon: Icon } = item
                  // Stagger across the whole nav, not per section, so the rows
                  // reveal as one sweep instead of three overlapping waves.
                  const step = navOffsets[sectionIndex] + i

                  if (item.children) {
                    const childActive = groupHasActive(item)
                    const open = !collapsed && isGroupOpen(item)
                    return (
                      <li key={href} className="group/tip relative">
                        {collapsed ? (
                          <Link
                            href={item.children[0].href}
                            data-active={childActive}
                            onClick={() => setSidebarOpen(false)}
                            style={{ "--i": step } as React.CSSProperties}
                            className={cn(
                              "reveal-left relative z-10 flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-colors duration-200",
                              childActive
                                ? "text-brand-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                            aria-label={label}
                          >
                            <Icon className="h-[18px] w-[18px] shrink-0" />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            // When the group is shut the parent row stands in
                            // for its active child, so the highlight has a home.
                            data-active={childActive && !open}
                            aria-expanded={open}
                            onClick={() =>
                              setGroupOverride((g) => ({ ...g, [href]: !isGroupOpen(item) }))
                            }
                            style={{ "--i": step } as React.CSSProperties}
                            className={cn(
                              "reveal-left relative z-10 flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-200",
                              childActive && !open
                                ? "text-brand-foreground"
                                : childActive
                                  ? "text-sidebar-accent-foreground hover:bg-sidebar-accent"
                                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <Icon className="h-[18px] w-[18px] shrink-0" />
                            <span className="flex-1 truncate text-left">{label}</span>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 opacity-60 transition-transform duration-300",
                                open && "rotate-180"
                              )}
                            />
                          </button>
                        )}

                        {!collapsed && (
                          <div
                            className={cn(
                              "grid transition-[grid-template-rows] duration-300 ease-out-expo",
                              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                            )}
                          >
                            <ul className="ml-[21px] min-h-0 space-y-0.5 overflow-hidden border-l border-sidebar-border pl-2.5">
                              {item.children.map((child, ci) => {
                                const active = open && child.href === activeHref
                                return (
                                  <li key={child.href} className={cn("relative", ci === 0 && "mt-0.5")}>
                                    <Link
                                      href={child.href}
                                      data-active={active}
                                      tabIndex={open ? undefined : -1}
                                      onClick={() => setSidebarOpen(false)}
                                      className={cn(
                                        "relative z-10 flex h-9 items-center rounded-lg px-3 text-[13px] font-medium transition-colors duration-200",
                                        active
                                          ? "text-brand-foreground"
                                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                      )}
                                    >
                                      <span className="truncate">{child.label}</span>
                                    </Link>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )}

                        {collapsed && (
                          // Flyout: padded rather than offset so the pointer
                          // can cross the gap without the menu closing.
                          <div className="invisible absolute left-full top-0 z-50 pl-3 opacity-0 transition-all duration-200 group-hover/tip:visible group-hover/tip:opacity-100">
                            <div className="min-w-48 rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-border">
                              <p className="px-2.5 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {label}
                              </p>
                              {item.children.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={() => setSidebarOpen(false)}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                                    child.href === activeHref
                                      ? "bg-brand-soft text-brand-soft-foreground"
                                      : "hover:bg-muted"
                                  )}
                                >
                                  <child.icon className="h-3.5 w-3.5 shrink-0" />
                                  {child.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  }

                  const active = href === activeHref
                  return (
                    <li key={href} className="group/tip relative">
                      <Link
                        href={href}
                        data-active={active}
                        onClick={() => setSidebarOpen(false)}
                        style={{ "--i": step } as React.CSSProperties}
                        className={cn(
                          "reveal-left relative z-10 flex h-10 items-center rounded-lg text-sm font-medium transition-colors duration-200",
                          collapsed ? "justify-center px-0" : "gap-3 px-3",
                          active
                            ? "text-brand-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="truncate">{label}</span>}
                      </Link>

                      {collapsed && (
                        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-md bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground opacity-0 shadow-md ring-1 ring-border transition-all duration-200 group-hover/tip:translate-x-0 group-hover/tip:opacity-100">
                          {label}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Account */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold uppercase text-brand-foreground">
                {initials}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label="Logout"
                className="press flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger-soft-foreground disabled:opacity-60"
              >
                {loggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold uppercase text-brand-foreground">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
                    {user.name}
                  </p>
                  <p className="truncate text-2xs text-muted-foreground">
                    {ROLE_LABELS[user.role]}
                    {user.branches.length > 0 && ` · ${user.branches.join(", ")}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="press mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-danger-soft hover:text-danger-soft-foreground disabled:opacity-60"
              >
                {loggingOut ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 shrink-0" />
                )}
                {loggingOut ? "Signing out…" : "Logout"}
              </button>
            </>
          )}
        </div>

        {/* Collapse handle */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          // Sits just below the brand header (h-20), centred on its border.
          className="press absolute -right-3 top-[86px] z-50 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground lg:flex"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>

      {/* Main column */}
      <div
        className={cn(
          "flex min-h-svh min-w-0 flex-col transition-[padding] duration-300 ease-out-expo",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[264px]"
        )}
      >
        <header className="glass sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="press rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">
              {pageTitle}
            </h1>
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.href} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-border">/</span>}
                  <span
                    className={
                      i === breadcrumbs.length - 1 ? "font-medium text-brand" : ""
                    }
                  >
                    {crumb.label}
                  </span>
                </span>
              ))}
            </nav>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="press hidden h-9 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-sm text-muted-foreground hover:bg-muted md:flex"
            >
              <Search className="h-4 w-4" />
              <span className="pr-6">Search…</span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-2xs font-medium">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Toggle theme"
              className="press relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {mounted && (
                <>
                  <Sun
                    className={cn(
                      "absolute h-4 w-4 transition-all duration-300 ease-spring",
                      isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0"
                    )}
                  />
                  <Moon
                    className={cn(
                      "absolute h-4 w-4 transition-all duration-300 ease-spring",
                      isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
                    )}
                  />
                </>
              )}
            </button>

            <button
              type="button"
              aria-label="Notifications"
              className="press relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              {/* Sized to the larger type scale so the count is not cramped. */}
              <span className="tnum absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-2xs font-bold text-danger-foreground">
                5
              </span>
              <span className="absolute -right-1.5 -top-1.5 h-[18px] w-[18px] animate-ping rounded-full bg-danger/40" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="press flex items-center gap-2 rounded-lg border border-border py-1 pl-1 pr-1.5 transition-colors hover:bg-muted data-[state=open]:bg-muted sm:pr-2"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-2xs font-bold uppercase text-brand-foreground">
                    {initials}
                  </span>
                  <span className="hidden text-xs font-medium capitalize sm:block">
                    {username}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuLabel>
                  <span className="block truncate text-sm font-medium text-foreground">
                    {user.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                  <span className="mt-1.5 inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-2xs font-semibold text-brand-soft-foreground">
                    {ROLE_LABELS[user.role]}
                  </span>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                    Profile
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem
                  // Radix returns focus to the trigger as it closes, which would
                  // steal it from the dialog opening behind it.
                  onSelect={(event) => {
                    event.preventDefault()
                    setPasswordOpen(true)
                  }}
                >
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  Change password
                </DropdownMenuItem>

                <DropdownMenuItem
                  destructive
                  disabled={loggingOut}
                  // Radix restores focus to the trigger on close, which would
                  // fight the navigation; the sign-out handler owns it instead.
                  onSelect={(event) => {
                    event.preventDefault()
                    void handleLogout()
                  }}
                >
                  {loggingOut ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  {loggingOut ? "Signing out…" : "Logout"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <div key={pathname} className="animate-fade-up">
            {children}
          </div>
        </main>
      </div>

      <ChangePasswordDialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />

      {paletteOpen && (
        <CommandPalette
          items={sections.flatMap((section) =>
            section.items.flatMap((item) =>
              item.children
                ? item.children.map((child) => ({
                    ...child,
                    label: `${item.label} · ${child.label}`,
                  }))
                : [item]
            )
          )}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  )
}
