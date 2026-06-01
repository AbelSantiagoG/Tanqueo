"use client"

import { RecordsView } from "@/components/views/records-view"
import { useAuth } from "@/lib/auth-context"

export function OperatorHistoryView() {
  const { user } = useAuth()
  return <RecordsView operatorId={user?.id} />
}
