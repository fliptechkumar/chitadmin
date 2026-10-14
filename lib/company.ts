import "server-only"

import { cache } from "react"

import { prisma } from "./prisma"
import { COMPANY_DEFAULTS, type CompanyProfile } from "./company-schema"

/**
 * The company profile, memoised per request so a layout and the page inside it
 * share one query. Falls back to defaults when nothing has been saved yet, so
 * branding is never blank on a fresh database.
 */
export const getCompany = cache(async (): Promise<CompanyProfile> => {
  const row = await prisma.companyProfile.findUnique({ where: { id: 1 } })
  if (!row) return COMPANY_DEFAULTS

  // Columns are nullable; the UI type is not, so nulls collapse to "".
  return {
    name: row.name,
    shortName: row.shortName,
    regNo: row.regNo ?? "",
    gst: row.gst ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    website: row.website ?? "",
    addressLine: row.addressLine ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    pincode: row.pincode ?? "",
    logo: row.logo ?? "",
  }
})

/** Writes the singleton, creating it on first save. */
export async function saveCompany(input: CompanyProfile): Promise<CompanyProfile> {
  const data = {
    name: input.name,
    shortName: input.shortName,
    regNo: input.regNo || null,
    gst: input.gst || null,
    phone: input.phone || null,
    email: input.email || null,
    website: input.website || null,
    addressLine: input.addressLine || null,
    city: input.city || null,
    state: input.state || null,
    pincode: input.pincode || null,
    logo: input.logo || null,
  }

  await prisma.companyProfile.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  })

  return input
}
