import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { client } from '@/ui/api/client'

type ShareVisit = {
  shareId: string
  assetId?: string
  submitted: boolean
  entered: boolean
}

const ShareVisitContext = createContext<{ current: ShareVisit | null } | null>(null)

export function PublicShareViewProvider({ children }: { children: ReactNode }) {
  const visit = useRef<ShareVisit | null>(null)
  return <ShareVisitContext.Provider value={visit}>{children}</ShareVisitContext.Provider>
}

export function usePublicShareView({
  shareId,
  assetId,
  password,
  ready,
}: {
  shareId: string
  assetId?: string
  password: string
  ready: boolean
}) {
  const visit = useContext(ShareVisitContext)
  useEffect(() => {
    if (!visit) return
    if (visit.current?.shareId !== shareId || visit.current.assetId !== assetId) {
      visit.current = {
        shareId,
        assetId,
        submitted: false,
        entered: visit.current?.shareId === shareId && visit.current.entered,
      }
    }
    if (!ready || visit.current.submitted) return

    const activeVisit = visit.current
    const isShareEntry = !activeVisit.entered
    activeVisit.submitted = true
    activeVisit.entered = true
    void client.api.shares[':shareId'].views
      .$post(
        { param: { shareId }, json: { assetId, isShareEntry } },
        { headers: { 'x-share-password': password } },
      )
      .then((response) => {
        if (!response.ok) throw new Error(`Share view returned ${response.status}`)
      })
      .catch((error: unknown) => console.error('Failed to record share view', error))
  }, [assetId, password, ready, shareId, visit])
}
