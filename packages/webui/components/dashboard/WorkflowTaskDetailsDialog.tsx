import { useState } from 'react'
import type { WorkflowTaskItem } from '@shumai/dtos'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/ui/tabs'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import { Badge } from '@/ui/components/ui/badge'
import { Button } from '@/ui/components/ui/button'
import { Copy, Check, Clock, Cpu, FileText } from 'lucide-react'
import { m } from '@/ui/paraglide/messages.js'
import { formatTimeAgo } from '@/ui/lib/time'

interface WorkflowTaskDetailsDialogProps {
  task: WorkflowTaskItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkflowTaskDetailsDialog({
  task,
  open,
  onOpenChange,
}: WorkflowTaskDetailsDialogProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  if (!task) return null

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => {
      setCopiedKey(null)
    }, 2000)
  }

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case 'completed':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-mono"
          >
            completed
          </Badge>
        )
      case 'processing':
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs font-mono"
          >
            processing
          </Badge>
        )
      case 'pending':
        return (
          <Badge
            variant="outline"
            className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 text-xs font-mono"
          >
            pending
          </Badge>
        )
      case 'failed':
        return (
          <Badge
            variant="outline"
            className="bg-destructive/10 text-destructive border-destructive/20 text-xs font-mono"
          >
            failed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs font-mono">
            {status || 'unknown'}
          </Badge>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-2 border-b border-border/50">
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <DialogTitle className="text-lg font-bold">{m.task_details()}</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(task.status)}
              {task.type && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {task.type}
                </Badge>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <span>
              {m.task_id()}: <span className="font-mono text-foreground">{task.id}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={() => copyToClipboard(task.id, 'task_id')}
            >
              {copiedKey === 'task_id' ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </DialogDescription>
        </DialogHeader>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-3 text-xs border-b border-border/40">
          <div>
            <div className="text-muted-foreground">{m.asset_id()}</div>
            <div className="font-mono truncate font-medium text-foreground mt-0.5">
              {task.assetId || '-'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{m.project_id()}</div>
            <div className="font-mono truncate font-medium text-foreground mt-0.5">
              {task.projectId || '-'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{m.created_at()}</div>
            <div className="font-medium text-foreground mt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {formatTimeAgo(task.createdAt)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">{m.updated_at()}</div>
            <div className="font-medium text-foreground mt-0.5">
              {formatTimeAgo(task.updatedAt)}
            </div>
          </div>
          {task.heartbeat && (
            <div>
              <div className="text-muted-foreground">{m.heartbeat()}</div>
              <div className="font-medium text-foreground mt-0.5">
                {formatTimeAgo(task.heartbeat)}
              </div>
            </div>
          )}
          {task.model && (
            <div>
              <div className="text-muted-foreground">{m.model()}</div>
              <div className="font-mono truncate font-medium text-foreground mt-0.5">
                {task.model}
              </div>
            </div>
          )}
          {(task.inputTokens > 0 || task.outputTokens > 0) && (
            <div>
              <div className="text-muted-foreground flex items-center gap-1">
                <Cpu className="h-3 w-3" /> {m.tokens_label()}
              </div>
              <div className="font-medium text-foreground mt-0.5 font-mono">
                {task.inputTokens.toLocaleString()} in / {task.outputTokens.toLocaleString()} out
              </div>
            </div>
          )}
          {task.sessionId && (
            <div className="col-span-2">
              <div className="text-muted-foreground">{m.session_id()}</div>
              <div className="font-mono truncate font-medium text-foreground mt-0.5">
                {task.sessionId}
              </div>
            </div>
          )}
        </div>

        {/* Tabs for Payload and Output */}
        <div className="flex-1 min-h-0 pt-3">
          <Tabs defaultValue="payload" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="payload">{m.payload()}</TabsTrigger>
              <TabsTrigger value="output">{m.output()}</TabsTrigger>
            </TabsList>
            <TabsContent value="payload" className="flex-1 mt-2 min-h-0">
              <ScrollArea className="h-64 w-full rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-xs">
                <pre className="whitespace-pre-wrap break-all text-foreground/90">
                  {task.payload ? JSON.stringify(task.payload, null, 2) : 'null'}
                </pre>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="output" className="flex-1 mt-2 min-h-0">
              <ScrollArea className="h-64 w-full rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-xs">
                <pre className="whitespace-pre-wrap break-all text-foreground/90">
                  {task.output ? JSON.stringify(task.output, null, 2) : 'null'}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
