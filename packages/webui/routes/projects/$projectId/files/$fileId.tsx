import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/projects/$projectId/files/$fileId')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      version: (search.version as string) || undefined,
      start: search.start ? Number(search.start) : undefined,
      compare: search.compare === true || search.compare === 'true' || undefined,
      cmpLeft: (search.cmpLeft as string) || undefined,
      cmpRight: (search.cmpRight as string) || undefined,
      cmpActive: search.cmpActive === 'right' ? 'right' : undefined,
    } as {
      version?: string
      start?: number
      compare?: boolean
      cmpLeft?: string
      cmpRight?: string
      cmpActive?: 'left' | 'right'
    }
  },
})
