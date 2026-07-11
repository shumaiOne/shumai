import { useDroppable } from '@dnd-kit/react'
import { useChatbotStore } from '@/ui/stores/chatbot'
import { File, Folder, X, MessageSquare } from 'lucide-react'
import { cn } from '@/ui/lib/utils'
import { m } from '@/ui/paraglide/messages.js'

export function ChatbotSidebar() {
  const { chatAssets, removeAsset, clearAssets } = useChatbotStore()

  const { ref: setDroppableRef, isDropTarget: isOver } = useDroppable({
    id: 'chatbot-sidebar',
    data: {
      type: 'chatbot-sidebar',
    },
  })

  return (
    <div
      ref={setDroppableRef}
      className={cn(
        'flex flex-col h-full bg-background transition-colors duration-200 min-h-0',
        isOver && 'bg-accent/50 ring-2 ring-primary ring-inset',
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 font-semibold">
          <MessageSquare className="h-5 w-5 text-primary" />
          <span>{m.chatbot_context()}</span>
        </div>
        {chatAssets.length > 0 && (
          <button
            onClick={clearAssets}
            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
          >
            {m.clear()}
          </button>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto min-h-0 space-y-4">
        {chatAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-lg text-muted-foreground p-4 text-center">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50 text-muted-foreground" />
            <p className="text-sm">{m.chatbot_drag_drop_hint()}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {m.context_assets_count({ count: chatAssets.length })}
            </h3>
            <div className="divide-y divide-border border border-border rounded-md bg-muted/10 max-h-[400px] overflow-y-auto">
              {chatAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between p-2.5 text-sm group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {asset.type === 'folder' ? (
                      <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    ) : (
                      <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="truncate font-medium text-foreground">{asset.name}</span>
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full capitalize">
                      {asset.type}
                    </span>
                  </div>
                  <button
                    onClick={() => removeAsset(asset.id)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5"
                    title={m.remove_from_context()}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
