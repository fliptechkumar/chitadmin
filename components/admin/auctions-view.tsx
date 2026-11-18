"use client"

import { useState } from "react"
import { Gavel, Trophy } from "lucide-react"

import { SegmentedTabs } from "@/components/ui/tabs"
import AuctionsTable, { type GroupOption } from "./auctions-table"
import PrizedMembers from "./prized-members"

type View = "rounds" | "prized"

const VIEWS = [
  { id: "rounds", label: "Rounds", icon: <Gavel className="h-4 w-4" /> },
  { id: "prized", label: "Prized members", icon: <Trophy className="h-4 w-4" /> },
] as const

/** The auctions page: the round register, or who has already taken the pot. */
export default function AuctionsView({
  branches,
  groups,
}: {
  branches: string[]
  groups: GroupOption[]
}) {
  const [view, setView] = useState<View>("rounds")

  return (
    <div className="space-y-4">
      <SegmentedTabs items={VIEWS} value={view} onChange={setView} />
      {view === "rounds" ? (
        <AuctionsTable branches={branches} groups={groups} />
      ) : (
        <PrizedMembers branches={branches} groups={groups} />
      )}
    </div>
  )
}
