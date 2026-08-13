import { useState } from 'react'
import { CircleHelp, Sparkles, Bot, Ban } from 'lucide-react'
import { m } from '@/ui/paraglide/messages.js'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/components/ui/dialog'

export function AutofillSourceHelpTrigger() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-4 w-4 p-0 hover:bg-transparent text-muted-foreground hover:text-foreground inline-flex items-center justify-center shrink-0 ml-1"
          title={m.autofill_source_help_title()}
        >
          <CircleHelp className="h-3.5 w-3.5" />
          <span className="sr-only">{m.autofill_source_help_title()}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleHelp className="h-5 w-5 text-muted-foreground" />
            {m.autofill_source_help_title()}
          </DialogTitle>
          <DialogDescription>{m.autofill_source_help_desc()}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Option 1: None */}
          <div className="rounded-lg border p-3.5 space-y-1.5 bg-muted/30">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Ban className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{m.autofill_source_none()}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {m.autofill_source_none_desc()}
            </p>
            <p className="text-xs italic text-muted-foreground/80">
              {m.autofill_source_none_example()}
            </p>
          </div>

          {/* Option 2: Content */}
          <div className="rounded-lg border p-3.5 space-y-1.5 bg-muted/30">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <span>{m.autofill_source_content()}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {m.autofill_source_content_desc()}
            </p>
            <p className="text-xs italic text-muted-foreground/80">
              {m.autofill_source_content_example()}
            </p>
          </div>

          {/* Option 3: Creation Context */}
          <div className="rounded-lg border p-3.5 space-y-1.5 bg-muted/30">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Bot className="h-4 w-4 text-blue-500 shrink-0" />
              <span>{m.autofill_source_creation_context()}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {m.autofill_source_creation_context_desc()}
            </p>
            <p className="text-xs italic text-muted-foreground/80">
              {m.autofill_source_creation_context_example()}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
