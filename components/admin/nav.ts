import {
  Banknote,
  BarChart2,
  ClipboardList,
  Briefcase,
  CalendarClock,
  Gavel,
  LayoutDashboard,
  NotebookPen,
  Settings2,
  ShieldCheck,
  Receipt,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import type { Role } from "@/lib/roles"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** Shown as the secondary line in the command palette. */
  hint: string
  /** Roles that may see this entry. Must agree with ROUTE_RULES in lib/rbac.ts. */
  roles: readonly Role[]
  /**
   * Sub-pages shown as a collapsible group. The parent itself is not a
   * destination; its `href` only keys the group and its open state.
   */
  children?: NavItem[]
}

export type NavSection = { title: string; items: NavItem[] }

const ADMINS = ["SUPER_ADMIN", "CHIT_ADMIN"] as const
const SUPER_ONLY = ["SUPER_ADMIN"] as const

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/home",
        icon: LayoutDashboard,
        hint: "Collections, targets and today's activity",
        roles: ADMINS,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        label: "Chit Groups",
        href: "/home/groups",
        icon: Users,
        hint: "Schemes, schedules and vacancies",
        roles: ADMINS,
      },
      {
        label: "Applicants",
        href: "/home/applicants",
        icon: UserCheck,
        hint: "Enrolments, documents and allocation",
        roles: ADMINS,
      },
      {
        label: "Employees",
        href: "/home/employees",
        icon: Briefcase,
        hint: "Staff, branches and targets",
        roles: ADMINS,
      },
      {
        label: "Auctions",
        href: "/home/auctions",
        icon: Gavel,
        hint: "Rounds, winners and discounts",
        roles: ADMINS,
      },
      {
        label: "Customer Dues",
        href: "/home/dues",
        icon: Wallet,
        hint: "Instalments owed, part paid and overdue",
        roles: ADMINS,
      },
      {
        label: "Collections",
        href: "/home/collections",
        icon: Receipt,
        hint: "Receipts, penalties and payment modes",
        roles: ADMINS,
      },
      {
        label: "Collection Records",
        href: "/home/collection-records",
        icon: NotebookPen,
        hint: "Month-by-month amounts, dates and routes per customer",
        roles: ADMINS,
      },
    ],
  },
  {
    title: "Insights",
    items: [
      {
        label: "Reports",
        href: "/home/reports",
        icon: BarChart2,
        hint: "Route collection sheets and other reports",
        roles: ADMINS,
        children: [
          {
            label: "Route Collection Sheet",
            href: "/home/reports/collection-sheet",
            icon: ClipboardList,
            hint: "What each route's subscribers owe this period",
            roles: ADMINS,
          },
        ],
      },
      {
        label: "Denomination",
        href: "/home/reports/denomination",
        icon: Banknote,
        hint: "Day-end cash count against receipts, by route",
        roles: ADMINS,
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "Users",
        href: "/home/users",
        icon: ShieldCheck,
        hint: "Accounts, roles and branch access",
        roles: ADMINS,
      },
      {
        label: "Settings",
        href: "/home/settings",
        icon: Settings2,
        hint: "Company, roles, interest and penalties",
        roles: SUPER_ONLY,
      },
      {
        label: "Chit Interval",
        href: "/home/chit-interval",
        icon: CalendarClock,
        hint: "Monthly collection schedule for each chit scheme",
        roles: SUPER_ONLY,
      },
    ],
  },
]

/** Every navigable page: plain entries plus the children of each group. */
export function navLeaves(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => item.children ?? [item])
}

export const NAV_ITEMS: NavItem[] = navLeaves(NAV_SECTIONS.flatMap((s) => s.items))

/**
 * Display names for path prefixes, so breadcrumbs read "Route Collection Sheet"
 * rather than the URL slug. A group's own label wins over its overview child.
 */
export const NAV_LABELS: ReadonlyMap<string, string> = new Map(
  NAV_SECTIONS.flatMap((s) => s.items).flatMap((item) => [
    ...(item.children ?? [])
      .filter((child) => child.href !== item.href)
      .map((child) => [child.href, child.label] as const),
    [item.href, item.label] as const,
  ])
)

/**
 * The nav a given role should see. Purely cosmetic — hiding a link is not a
 * security boundary; middleware and the route handlers do the enforcing.
 */
export function navSectionsFor(role: Role): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .filter((item) => item.roles.includes(role))
      .map((item) =>
        item.children
          ? { ...item, children: item.children.filter((c) => c.roles.includes(role)) }
          : item
      )
      .filter((item) => !item.children || item.children.length > 0),
  })).filter((section) => section.items.length > 0)
}

/** The nav entry that owns a pathname, matching the deepest route first. */
export function activeNavHref(pathname: string) {
  const match = [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  return match?.href ?? "/home"
}
