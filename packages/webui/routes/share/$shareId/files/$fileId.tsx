import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/share/$shareId/files/$fileId')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      start: search.start ? Number(search.start) : undefined,
      version: (search.version as string) || undefined,
      compare: search.compare === true || search.compare === 'true' || undefined,
      cmpLeft: (search.cmpLeft as string) || undefined,
      cmpRight: (search.cmpRight as string) || undefined,
      cmpActive: search.cmpActive === 'right' ? 'right' : undefined,
    } as {
      start?: number
      version?: string
      compare?: boolean
      cmpLeft?: string
      cmpRight?: string
      cmpActive?: 'left' | 'right'
    }
  },
})
