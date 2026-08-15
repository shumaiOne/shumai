import { client } from '@/ui/api/client'
import { usePermissions } from '@/ui/hooks/use-permissions'
import { m } from '@/ui/paraglide/messages.js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, Check, Lock, Save, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MarkdownEditor } from '../markdown-editor/markdown-editor'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'

export interface AgentsMdEditorProps {
  projectId: string
  assetId: string
  rootFolderId: string
  isRoot?: boolean
}

export function AgentsMdEditor({ projectId, assetId, rootFolderId, isRoot }: AgentsMdEditorProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canAdmin } = usePermissions(projectId)

  const { data, isLoading } = useQuery({
    queryKey: ['folders', assetId, 'agentsmd'],
    queryFn: async () => {
      const res = await client.api.folders[':folderId'].agentsmd.$get({
        param: { folderId: assetId },
      })
      if (!res.ok) throw new Error('Failed to fetch agents.md')
      return await res.json()
    },
  })

  const [content, setContent] = useState<string>('')
  const [isInitialized, setIsInitialized] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestContentRef = useRef<string>('')
  const lastSavedContentRef = useRef<string | null>(null)
  // Serializes autosaves so a newer write can never be overwritten by an older
  // in-flight request completing out of order.
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    if (!isInitialized && data !== undefined) {
      const initial = data.content ?? ''
      setContent(initial)
      latestContentRef.current = initial
      lastSavedContentRef.current = initial
      setIsInitialized(true)
    }
  }, [data, isInitialized])

  const [isClosing, setIsClosing] = useState(false)

  const saveMutation = useMutation({
    mutationFn: async (newContent: string) => {
      const res = await client.api.folders[':folderId'].agentsmd.$patch({
        param: { folderId: assetId },
        json: { content: newContent },
      })
      if (!res.ok) throw new Error('Failed to save agents.md')
      return await res.json()
    },
    onSuccess: (_, newContent) => {
      setSaveStatus('saved')
      lastSavedContentRef.current = newContent
      queryClient.setQueryData(['folders', assetId, 'agentsmd'], { content: newContent })
      queryClient.invalidateQueries({ queryKey: ['folders', assetId] })
      if (clearSavedTimeoutRef.current) {
        clearTimeout(clearSavedTimeoutRef.current)
      }
      clearSavedTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle')
      }, 2500)
    },
    onError: () => {
      setSaveStatus('error')
    },
  })

  const saveMutationRef = useRef(saveMutation.mutateAsync)
  saveMutationRef.current = saveMutation.mutateAsync

  const enqueueSave = useCallback(
    (textToSave: string) => {
      if (!canAdmin) return Promise.resolve()
      if (lastSavedContentRef.current === textToSave) {
        setSaveStatus('saved')
        return Promise.resolve()
      }
      setSaveStatus('saving')
      const p = saveChainRef.current
        .then(async () => {
          await saveMutationRef.current(textToSave)
        })
        .catch(() => {
          // Swallow so a failed save does not break the chain for later saves.
          // The mutation's onError handler already surfaces the failure.
        })
      saveChainRef.current = p
      return p
    },
    [canAdmin],
  )

  const handleContentChange = useCallback(
    (newMarkdown: string) => {
      if (!canAdmin) return
      setContent(newMarkdown)
      latestContentRef.current = newMarkdown

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      setSaveStatus('saving')
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null
        enqueueSave(newMarkdown)
      }, 1000)
    },
    [canAdmin, enqueueSave],
  )

  // Flushes any pending debounced edits so they are not lost when the editor
  // unmounts (close button, folder-tree navigation, or route change).
  const flushPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
      return enqueueSave(latestContentRef.current)
    }
    return saveChainRef.current
  }, [enqueueSave])

  useEffect(() => {
    return () => {
      flushPendingSave()
      if (clearSavedTimeoutRef.current) {
        clearTimeout(clearSavedTimeoutRef.current)
      }
    }
  }, [flushPendingSave])

  const handleClose = async () => {
    setIsClosing(true)
    try {
      flushPendingSave()
      await saveChainRef.current
    } catch {
      // Proceed with navigation even if error occurs
    } finally {
      if (isRoot || assetId === rootFolderId) {
        navigate({
          to: '/projects/$projectId',
          params: { projectId },
        })
      } else {
        navigate({
          to: '/projects/$projectId/folders/$folderId',
          params: { projectId, folderId: assetId },
        })
      }
    }
  }

  const rightToolbarContent = (
    <div className="flex items-center justify-between w-full gap-2 shrink-0">
      {canAdmin ? (
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          {(saveStatus === 'saving' || isClosing) && (
            <span className="inline-flex items-center gap-1 text-muted-foreground animate-pulse whitespace-nowrap">
              <Save className="h-3.5 w-3.5 shrink-0" />
              <span>{m.saving_ellipsis()}</span>
            </span>
          )}
          {saveStatus === 'saved' && !isClosing && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span>{m.saved()}</span>
            </span>
          )}
          {saveStatus === 'error' && !isClosing && (
            <span className="inline-flex items-center gap-1 text-destructive font-medium whitespace-nowrap">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{m.agents_md_save_failed()}</span>
            </span>
          )}
        </div>
      ) : (
        <div
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md shrink-0"
          title={m.agents_md_readonly_hint()}
        >
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>{m.agents_md_readonly_hint()}</span>
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        {canAdmin && <Separator orientation="vertical" className="h-4 shrink-0" />}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          disabled={isClosing}
          className="h-7 px-2.5 hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          title={m.close()}
        >
          <X className="h-4 w-4 mr-1 shrink-0" />
          <span>{m.close()}</span>
        </Button>
      </div>
    </div>
  )

  if (isLoading || !isInitialized) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-sm text-muted-foreground">
        <Save className="h-4 w-4 animate-pulse mr-2" />
        <span>{m.agents_md_loading()}</span>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
      <MarkdownEditor
        value={content}
        onChange={handleContentChange}
        placeholder={m.agents_md_placeholder()}
        readOnly={!canAdmin}
        rightToolbarContent={rightToolbarContent}
        className="flex-1 flex flex-col h-full min-h-0 border rounded-lg shadow-sm"
      />
    </div>
  )
}
