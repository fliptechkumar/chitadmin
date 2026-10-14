import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { authorizeApi } from "@/lib/auth-server"
import { importMembers } from "@/lib/member-import"
import {
  findConflicts,
  parseMemberWorkbook,
  type SheetRow,
} from "@/lib/member-sheet"

/** Member import lives under Settings, which is Super-Admin-only (see lib/rbac.ts). */
const SUPER_ONLY = ["SUPER_ADMIN"] as const

/** A route sheet is tens of KB; this is generous while still bounding memory. */
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_FILES = 30

/**
 * Multipart body: one or more `files` (.xlsx) and `mode` — "preview" to report
 * what would change without writing, "apply" to write it.
 */
export async function POST(request: Request) {
  const auth = await authorizeApi(SUPER_ONLY)
  if (!auth.ok) return auth.response

  const form = await request.formData().catch(() => null)
  if (!form) {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 })
  }

  const apply = form.get("mode") === "apply"
  const files = form.getAll("files").filter((f): f is File => f instanceof File)

  if (files.length === 0) {
    return NextResponse.json({ error: "Choose at least one .xlsx file." }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Upload at most ${MAX_FILES} files at a time.` },
      { status: 400 }
    )
  }

  const rows: SheetRow[] = []
  const errors: string[] = []

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      errors.push(`${file.name}: only .xlsx files are accepted`)
      continue
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${file.name}: larger than ${MAX_FILE_BYTES / 1024 / 1024}MB`)
      continue
    }
    try {
      rows.push(...(await parseMemberWorkbook(file.name, await file.arrayBuffer())))
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${file.name}: could not be read`)
    }
  }

  // Any unreadable file stops the whole upload: applying the others alone
  // would leave the register half old, half new without anyone deciding that.
  errors.push(...findConflicts(rows))
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 })
  }

  const report = await importMembers(rows, { apply })

  if (report.applied) {
    revalidatePath("/home", "layout")
  }

  return NextResponse.json(report)
}
