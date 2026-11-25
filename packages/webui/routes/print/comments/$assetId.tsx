import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/print/comments/$assetId')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      shareId: typeof search.shareId === 'string' && search.shareId ? search.shareId : undefined,
    } as {
      shareId?: string
    }
  },
})
