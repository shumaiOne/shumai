import type { AssetInfo } from '@shumai/dtos'
import { m } from '@/ui/paraglide/messages.js'
import {
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuPortal,
} from '@/ui/components/ui/context-menu'
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/ui/components/ui/dropdown-menu'
import {
  Copy,
  Image as ImageIcon,
  FileText,
  Link,
  Download,
  Hash,
  Code,
  Table,
  HardDrive,
} from 'lucide-react'
import { type CopyKind, type CopyOptionsContext, getCopyOptions } from './copy-options'

interface CopyMenuProps {
  items: AssetInfo[]
  context: CopyOptionsContext
  onCopy: (kind: CopyKind, items: AssetInfo[]) => void
}

function renderCopyIcon(kind: CopyKind) {
  switch (kind) {
    case 'image':
      return <ImageIcon className="mr-2 h-4 w-4" />
    case 'name':
      return <FileText className="mr-2 h-4 w-4" />
    case 'link':
      return <Link className="mr-2 h-4 w-4" />
    case 'download-link':
      return <Download className="mr-2 h-4 w-4" />
    case 'id':
      return <Hash className="mr-2 h-4 w-4" />
    case 'markdown':
      return <Code className="mr-2 h-4 w-4" />
    case 'tsv':
      return <Table className="mr-2 h-4 w-4" />
    case 'storage-path':
      return <HardDrive className="mr-2 h-4 w-4" />
  }
}

function renderCopyLabel(kind: CopyKind) {
  switch (kind) {
    case 'image':
      return m.copy_image()
    case 'name':
      return m.copy_name()
    case 'link':
      return m.copy_app_link()
    case 'download-link':
      return m.copy_download_link()
    case 'id':
      return m.copy_id()
    case 'markdown':
      return m.copy_markdown_link()
    case 'tsv':
      return m.copy_as_table()
    case 'storage-path':
      return m.copy_storage_path()
  }
}

export function CopyContextMenuSub({ items, context, onCopy }: CopyMenuProps) {
  const options = getCopyOptions(items, context)
  if (options.length === 0) return null

  const imageOpt = options.find((o) => o.kind === 'image')
  const coreOpts = options.filter((o) => ['name', 'link', 'download-link', 'id'].includes(o.kind))
  const docOpts = options.filter((o) => ['markdown', 'tsv'].includes(o.kind))
  const storageOpt = options.find((o) => o.kind === 'storage-path')

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Copy className="mr-2 h-4 w-4" />
        <span>{m.copy()}</span>
      </ContextMenuSubTrigger>
      <ContextMenuPortal>
        <ContextMenuSubContent className="w-52">
          {imageOpt && (
            <>
              <ContextMenuItem disabled={imageOpt.disabled} onSelect={() => onCopy('image', items)}>
                {renderCopyIcon('image')}
                <span>{renderCopyLabel('image')}</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}

          {coreOpts.map((opt) => (
            <ContextMenuItem
              key={opt.kind}
              disabled={opt.disabled}
              onSelect={() => onCopy(opt.kind, items)}
            >
              {renderCopyIcon(opt.kind)}
              <span>{renderCopyLabel(opt.kind)}</span>
            </ContextMenuItem>
          ))}

          {docOpts.length > 0 && (
            <>
              <ContextMenuSeparator />
              {docOpts.map((opt) => (
                <ContextMenuItem
                  key={opt.kind}
                  disabled={opt.disabled}
                  onSelect={() => onCopy(opt.kind, items)}
                >
                  {renderCopyIcon(opt.kind)}
                  <span>{renderCopyLabel(opt.kind)}</span>
                </ContextMenuItem>
              ))}
            </>
          )}

          {storageOpt && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                disabled={storageOpt.disabled}
                onSelect={() => onCopy('storage-path', items)}
              >
                {renderCopyIcon('storage-path')}
                <span>{renderCopyLabel('storage-path')}</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuSubContent>
      </ContextMenuPortal>
    </ContextMenuSub>
  )
}

export function CopyDropdownMenuSub({ items, context, onCopy }: CopyMenuProps) {
  const options = getCopyOptions(items, context)
  if (options.length === 0) return null

  const imageOpt = options.find((o) => o.kind === 'image')
  const coreOpts = options.filter((o) => ['name', 'link', 'download-link', 'id'].includes(o.kind))
  const docOpts = options.filter((o) => ['markdown', 'tsv'].includes(o.kind))
  const storageOpt = options.find((o) => o.kind === 'storage-path')

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Copy className="mr-2 h-4 w-4" />
        <span>{m.copy()}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">
        {imageOpt && (
          <>
            <DropdownMenuItem
              disabled={imageOpt.disabled}
              onClick={(e) => {
                e.stopPropagation()
                onCopy('image', items)
              }}
            >
              {renderCopyIcon('image')}
              <span>{renderCopyLabel('image')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {coreOpts.map((opt) => (
          <DropdownMenuItem
            key={opt.kind}
            disabled={opt.disabled}
            onClick={(e) => {
              e.stopPropagation()
              onCopy(opt.kind, items)
            }}
          >
            {renderCopyIcon(opt.kind)}
            <span>{renderCopyLabel(opt.kind)}</span>
          </DropdownMenuItem>
        ))}

        {docOpts.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {docOpts.map((opt) => (
              <DropdownMenuItem
                key={opt.kind}
                disabled={opt.disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  onCopy(opt.kind, items)
                }}
              >
                {renderCopyIcon(opt.kind)}
                <span>{renderCopyLabel(opt.kind)}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {storageOpt && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={storageOpt.disabled}
              onClick={(e) => {
                e.stopPropagation()
                onCopy('storage-path', items)
              }}
            >
              {renderCopyIcon('storage-path')}
              <span>{renderCopyLabel('storage-path')}</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
