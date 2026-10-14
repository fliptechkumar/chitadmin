"use client"

import { useRef, useState } from "react"
import { CheckCircle2, FileSpreadsheet, Loader2, Search, Upload, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table"
import type { MemberImportReport } from "@/lib/member-import"

/** Skipped rows listed on screen; the rest are only counted. */
const MAX_SKIPPED_SHOWN = 50

/**
 * Upload of the Advance Preparation sheets from Settings. Always previews
 * first: the server reports what would change, and only then can the same
 * files be applied — so a wrong sheet is caught before it touches anyone.
 */
export default function MemberImportSettings() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [report, setReport] = useState<MemberImportReport | null>(null)

  function choose(list: FileList | null) {
    setFiles(list ? Array.from(list) : [])
    setReport(null)
    setErrors([])
  }

  function clear() {
    choose(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function send(mode: "preview" | "apply") {
    setBusy(mode)
    setErrors([])

    const body = new FormData()
    body.set("mode", mode)
    for (const file of files) body.append("files", file)

    try {
      const response = await fetch("/api/settings/members-import", { method: "POST", body })
      const data = (await response.json().catch(() => null)) as
        | (MemberImportReport & { error?: string; errors?: string[] })
        | null

      if (!response.ok || !data) {
        setReport(null)
        setErrors(data?.errors ?? [data?.error ?? "Upload failed. Try again."])
        return
      }
      setReport(data)
    } catch {
      setErrors(["Could not reach the server. Try again."])
    } finally {
      setBusy(null)
    }
  }

  const stats = report
    ? [
        { label: "Rows read", value: report.rows, tone: "neutral" as const },
        { label: "New members", value: report.created, tone: "success" as const },
        { label: "Updated", value: report.updated, tone: "brand" as const },
        { label: "No change", value: report.unchanged, tone: "neutral" as const },
        { label: "Seats assigned", value: report.seated, tone: "violet" as const },
        { label: "Skipped", value: report.skipped.length, tone: "warning" as const },
      ]
    : []

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Upload member sheets</CardTitle>
          <CardDescription>
            Advance Preparation exports (.xlsx), one per route. Members are matched on
            Account No: existing members are updated, new ones are added and seated on
            their ticket. Routes, staff and groups are not changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => choose(e.target.files)}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy !== null}
            >
              <Upload className="h-3.5 w-3.5" />
              {files.length > 0 ? "Choose other files" : "Choose .xlsx files"}
            </Button>
            {files.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clear} disabled={busy !== null}>
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>

          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {files.map((file) => (
                <li
                  key={file.name}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-foreground"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-success" />
                  {file.name}
                </li>
              ))}
            </ul>
          )}

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => send("preview")}
                disabled={busy !== null}
              >
                {busy === "preview" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                {busy === "preview" ? "Checking…" : "Check files"}
              </Button>
              {/* Only offered once a preview of these exact files came back. */}
              {report && !report.applied && (
                <Button size="sm" onClick={() => send("apply")} disabled={busy !== null}>
                  {busy === "apply" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {busy === "apply" ? "Updating…" : "Apply update"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <div className="space-y-1 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-soft-foreground">
          <p className="font-semibold">Nothing was changed. Fix these and upload again:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {report && (
        <div className="space-y-4">
          {report.applied ? (
            <div className="animate-scale-in flex items-center gap-2 rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm font-medium text-success-soft-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Member register updated.
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Preview only — nothing has been saved yet. Review the counts, then apply.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map(({ label, value, tone }) => (
              <div key={label} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Badge tone={value > 0 ? tone : "neutral"} size="md" className="mt-1 tabular-nums">
                  {value}
                </Badge>
              </div>
            ))}
          </div>

          {report.replaced > 0 && (
            <p className="text-xs text-muted-foreground">
              {report.replaced} seat(s) currently held by someone else will be given to the
              member the sheet names.
            </p>
          )}

          {report.skipped.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Skipped rows</CardTitle>
                <CardDescription>
                  These rows are left out; the rest {report.applied ? "were" : "will be"}{" "}
                  applied.
                  {report.skipped.length > MAX_SKIPPED_SHOWN &&
                    ` Showing the first ${MAX_SKIPPED_SHOWN} of ${report.skipped.length}.`}
                </CardDescription>
              </CardHeader>
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      {["File", "Row", "Account No", "Name", "Reason"].map((h) => (
                        <TH key={h}>{h}</TH>
                      ))}
                    </tr>
                  </THead>
                  <TBody>
                    {report.skipped.slice(0, MAX_SKIPPED_SHOWN).map((s, i) => (
                      <TR key={`${s.file}-${s.rowNo}`} index={i}>
                        <TD>{s.file}</TD>
                        <TD className="tabular-nums">{s.rowNo}</TD>
                        <TD className="font-mono text-xs">{s.accountNo || "—"}</TD>
                        <TD className="font-medium text-foreground">{s.name || "—"}</TD>
                        <TD>{s.why}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
