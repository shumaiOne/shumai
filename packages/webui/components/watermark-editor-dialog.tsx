import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  WatermarkConfigSpec,
  WatermarkBlock,
  WatermarkBlockText,
  WatermarkBlockImage,
  WatermarkTemplateInfo,
} from '@shumai/dtos'
import { m } from '@/ui/paraglide/messages.js'
import { client } from '@/ui/api/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/ui/components/ui/dialog'
import { Button } from '@/ui/components/ui/button'
import { Input } from '@/ui/components/ui/input'
import { Label } from '@/ui/components/ui/label'
import { Slider } from '@/ui/components/ui/slider'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/ui/components/ui/dropdown-menu'
import {
  Type,
  Image as ImageIcon,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Save,
  Check,
  LayoutGrid,
  Sun,
  Moon,
  Film,
  Sparkles,
} from 'lucide-react'

function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function createDefaultTextBlock(): WatermarkBlockText {
  return {
    id: generateUniqueId(),
    type: 'text',
    text: 'CONFIDENTIAL',
    x: 0.5,
    y: 0.5,
    size: 36,
    color: '#999999',
    opacity: 0.5,
    rotation: -30,
  }
}

function createDefaultImageBlock(): WatermarkBlockImage {
  return {
    id: generateUniqueId(),
    type: 'image',
    imageAssetId: 'sample-logo',
    x: 0.5,
    y: 0.5,
    size: 120,
    opacity: 0.5,
    rotation: 0,
  }
}

interface WatermarkEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialConfig?: WatermarkConfigSpec | null
  shareId: string
  teamId?: string | null
  onSaveSuccess?: () => void
}

export function WatermarkEditorDialog({
  open,
  onOpenChange,
  initialConfig,
  shareId,
  teamId,
  onSaveSuccess,
}: WatermarkEditorDialogProps) {
  const queryClient = useQueryClient()
  const [blocks, setBlocks] = useState<WatermarkBlock[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [backdrop, setBackdrop] = useState<'dark' | 'light' | 'sample'>('dark')
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null)

  // Save template dialog modal state
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false)
  const [saveTemplateMode, setSaveTemplateMode] = useState<'new' | 'overwrite'>('new')
  const [templateName, setTemplateName] = useState('')
  const [targetOverwriteTemplateId, setTargetOverwriteTemplateId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Initialize blocks from initialConfig or default
  useEffect(() => {
    if (open) {
      if (initialConfig?.blocks && initialConfig.blocks.length > 0) {
        setBlocks(initialConfig.blocks)
        setSelectedBlockId(initialConfig.blocks[0].id)
      } else {
        const defaultBlock = createDefaultTextBlock()
        setBlocks([defaultBlock])
        setSelectedBlockId(defaultBlock.id)
      }
      setLoadedTemplateId(null)
    }
  }, [open, initialConfig])

  // Fetch watermark templates
  const { data: templates = [] } = useQuery<WatermarkTemplateInfo[]>({
    queryKey: ['watermark-templates', teamId],
    queryFn: async () => {
      const res = await client.api['watermark-templates'].$get({
        query: teamId ? { teamId } : {},
      })
      if (!res.ok) return []
      return await res.json()
    },
    enabled: open,
  })

  // Save watermark to sharelink mutation
  const $updateWatermark = client.api.shares[':shareId'].watermark.$put
  const { mutate: saveWatermark, isPending: isSavingWatermark } = useMutation({
    mutationFn: async (config: WatermarkConfigSpec) => {
      const res = await $updateWatermark({
        param: { shareId },
        json: {
          enabled: true,
          config,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error((err as { error?: string })?.error || m.failed_update())
      }
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share', shareId] })
      queryClient.invalidateQueries({ queryKey: ['shares'] })
      toast.success(m.watermark_updated())
      onOpenChange(false)
      onSaveSuccess?.()
    },
    onError: (err: Error) => {
      toast.error(err.message || m.failed_update())
    },
  })

  // Template mutations
  const $createTemplate = client.api['watermark-templates'].$post
  const { mutate: createTemplate, isPending: isCreatingTemplate } = useMutation({
    mutationFn: async ({ name, config }: { name: string; config: WatermarkConfigSpec }) => {
      const res = await $createTemplate({
        json: {
          name,
          teamId: teamId || undefined,
          config,
        },
      })
      if (!res.ok) throw new Error(m.failed_update())
      return await res.json()
    },
    onSuccess: (data: WatermarkTemplateInfo) => {
      queryClient.invalidateQueries({ queryKey: ['watermark-templates'] })
      setLoadedTemplateId(data.id)
      setIsSaveTemplateOpen(false)
      toast.success(m.template_saved())
    },
    onError: () => {
      toast.error(m.failed_update())
    },
  })

  const $updateTemplate = client.api['watermark-templates'][':templateId'].$put
  const { mutate: updateTemplate, isPending: isUpdatingTemplate } = useMutation({
    mutationFn: async ({
      templateId,
      config,
    }: {
      templateId: string
      config: WatermarkConfigSpec
    }) => {
      const res = await $updateTemplate({
        param: { templateId },
        json: { config },
      })
      if (!res.ok) throw new Error(m.failed_update())
      return await res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watermark-templates'] })
      setIsSaveTemplateOpen(false)
      toast.success(m.template_updated())
    },
    onError: () => {
      toast.error(m.failed_update())
    },
  })

  const $deleteTemplate = client.api['watermark-templates'][':templateId'].$delete
  const { mutate: deleteTemplate } = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await $deleteTemplate({
        param: { templateId },
      })
      if (!res.ok) throw new Error(m.failed_to_delete())
    },
    onSuccess: (_, templateId) => {
      queryClient.invalidateQueries({ queryKey: ['watermark-templates'] })
      if (loadedTemplateId === templateId) {
        setLoadedTemplateId(null)
      }
      toast.success(m.template_deleted())
    },
    onError: () => {
      toast.error(m.failed_to_delete())
    },
  })

  // Selected block helper
  const selectedIndex = blocks.findIndex((b) => b.id === selectedBlockId)
  const selectedBlock = selectedIndex >= 0 ? blocks[selectedIndex] : null

  // Add block
  const handleAddTextBlock = () => {
    const newBlock = createDefaultTextBlock()
    setBlocks((prev) => [...prev, newBlock])
    setSelectedBlockId(newBlock.id)
  }

  const handleAddImageBlock = () => {
    const newBlock = createDefaultImageBlock()
    setBlocks((prev) => [...prev, newBlock])
    setSelectedBlockId(newBlock.id)
  }

  // Delete block
  const handleDeleteBlock = (id: string | null) => {
    if (!id) return
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id)
      if (selectedBlockId === id) {
        setSelectedBlockId(next.length > 0 ? next[Math.max(0, selectedIndex - 1)].id : null)
      }
      return next
    })
  }

  // Update specific block property
  const handleUpdateBlock = (id: string, updates: Partial<WatermarkBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? ({ ...b, ...updates } as WatermarkBlock) : b)),
    )
  }

  // Navigation helpers
  const handlePrevBlock = () => {
    if (blocks.length === 0) return
    const prevIdx = (selectedIndex - 1 + blocks.length) % blocks.length
    setSelectedBlockId(blocks[prevIdx].id)
  }

  const handleNextBlock = () => {
    if (blocks.length === 0) return
    const nextIdx = (selectedIndex + 1) % blocks.length
    setSelectedBlockId(blocks[nextIdx].id)
  }

  // Canvas Drag & Drop handlers
  const handleMouseDownCanvasBlock = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setSelectedBlockId(id)
    setIsDragging(true)
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !selectedBlockId || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const rawX = (e.clientX - rect.left) / rect.width
      const rawY = (e.clientY - rect.top) / rect.height

      const clampedX = Math.max(0, Math.min(1, Math.round(rawX * 100) / 100))
      const clampedY = Math.max(0, Math.min(1, Math.round(rawY * 100) / 100))

      handleUpdateBlock(selectedBlockId, { x: clampedX, y: clampedY })
    },
    [isDragging, selectedBlockId],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Keyboard shortcut for deleting block
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open || !selectedBlockId) return
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        handleDeleteBlock(selectedBlockId)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, selectedBlockId, selectedIndex])

  // Load template
  const handleSelectTemplate = (tpl: WatermarkTemplateInfo) => {
    if (tpl.config?.blocks && tpl.config.blocks.length > 0) {
      const clonedBlocks = tpl.config.blocks.map((b) => ({
        ...b,
        id: generateUniqueId(),
      }))
      setBlocks(clonedBlocks)
      setSelectedBlockId(clonedBlocks[0].id)
      setLoadedTemplateId(tpl.id)
      toast.success(m.template_saved())
    }
  }

  const handleSaveWatermark = () => {
    if (blocks.length === 0) {
      toast.error(m.no_watermark_blocks())
      return
    }
    saveWatermark({ blocks })
  }

  const handleConfirmSaveTemplate = () => {
    if (saveTemplateMode === 'new') {
      if (!templateName.trim()) {
        toast.error(m.enter_template_name())
        return
      }
      createTemplate({ name: templateName.trim(), config: { blocks } })
    } else {
      const targetId = targetOverwriteTemplateId || loadedTemplateId
      if (!targetId) {
        toast.error(m.select_template_to_overwrite())
        return
      }
      updateTemplate({ templateId: targetId, config: { blocks } })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[1400px] w-[95vw] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-semibold">{m.watermark_editor()}</DialogTitle>
            </div>

            <div className="flex items-center gap-2">
              {/* Templates Dropdown Menu */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-xs">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    {m.watermark_templates()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                    {m.load_template()}
                  </DropdownMenuLabel>
                  {templates.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground italic">
                      {m.no_templates_found()}
                    </div>
                  ) : (
                    templates.map((tpl) => (
                      <DropdownMenuItem
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className="flex items-center justify-between text-xs cursor-pointer"
                      >
                        <span className="truncate flex-1">{tpl.name}</span>
                        {loadedTemplateId === tpl.id && (
                          <Check className="h-3.5 w-3.5 text-primary ml-2 flex-shrink-0" />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive ml-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteTemplate(tpl.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </DropdownMenuItem>
                    ))
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => {
                      setSaveTemplateMode('new')
                      setTemplateName('')
                      setIsSaveTemplateOpen(true)
                    }}
                    className="text-xs gap-2 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-primary" />
                    {m.create_new_template()}
                  </DropdownMenuItem>

                  {templates.length > 0 && (
                    <DropdownMenuItem
                      onClick={() => {
                        setSaveTemplateMode('overwrite')
                        setTargetOverwriteTemplateId(loadedTemplateId || templates[0].id)
                        setIsSaveTemplateOpen(true)
                      }}
                      className="text-xs gap-2 cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5 text-muted-foreground" />
                      {m.overwrite_existing_template()}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => onOpenChange(false)}
              >
                {m.cancel()}
              </Button>
              <Button
                size="sm"
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                disabled={isSavingWatermark}
                onClick={handleSaveWatermark}
              >
                <Save className="h-3.5 w-3.5" />
                {m.save_watermark()}
              </Button>
            </div>
          </div>

          {/* Main 2-Column Content Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Preview Column (2/3 width) */}
            <div className="w-[65%] flex flex-col p-4 bg-muted/20 border-r border-border overflow-hidden select-none">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">{m.preview()}</span>
                <div className="flex items-center gap-1 bg-background border border-border rounded-md p-1">
                  <Button
                    variant={backdrop === 'dark' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-6 w-6 rounded text-xs"
                    title={m.dark_grid()}
                    onClick={() => setBackdrop('dark')}
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={backdrop === 'light' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-6 w-6 rounded text-xs"
                    title={m.light_grid()}
                    onClick={() => setBackdrop('light')}
                  >
                    <Sun className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={backdrop === 'sample' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-6 w-6 rounded text-xs"
                    title={m.sample_backdrop()}
                    onClick={() => setBackdrop('sample')}
                  >
                    <Film className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Canvas Frame */}
              <div className="flex-1 flex items-center justify-center overflow-hidden">
                <div
                  ref={canvasRef}
                  onClick={() => setSelectedBlockId(null)}
                  className={cn(
                    'relative w-full aspect-video max-h-full rounded-lg border border-border overflow-hidden shadow-inner transition-colors',
                    backdrop === 'dark' &&
                      'bg-slate-950 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]',
                    backdrop === 'light' &&
                      'bg-slate-100 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]',
                    backdrop === 'sample' &&
                      'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900',
                  )}
                >
                  {/* Sample Backdrop decorative elements */}
                  {backdrop === 'sample' && (
                    <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-30">
                      <div className="flex items-center justify-between text-white text-[10px] font-mono">
                        <span>PREVIEW VIDEO FRAME</span>
                        <span>00:01:24:12</span>
                      </div>
                      <div className="h-1 bg-white/20 rounded w-full" />
                    </div>
                  )}

                  {/* Render Blocks */}
                  {blocks.map((block) => {
                    const isSelected = block.id === selectedBlockId
                    return (
                      <div
                        key={block.id}
                        onMouseDown={(e) => handleMouseDownCanvasBlock(e, block.id)}
                        style={{
                          left: `${block.x * 100}%`,
                          top: `${block.y * 100}%`,
                          transform: `translate(-50%, -50%) rotate(${block.rotation}deg)`,
                          opacity: block.opacity,
                        }}
                        className={cn(
                          'absolute cursor-move select-none transition-shadow rounded p-1.5 flex items-center justify-center',
                          isSelected
                            ? 'ring-2 ring-primary ring-offset-2 ring-offset-background/80 bg-primary/10'
                            : 'hover:ring-1 hover:ring-muted-foreground/50',
                        )}
                      >
                        {block.type === 'text' ? (
                          <span
                            style={{
                              fontSize: `${block.size}px`,
                              color: block.color,
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                              fontWeight: 700,
                              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                            }}
                          >
                            {block.text || 'Text'}
                          </span>
                        ) : (
                          <div
                            style={{
                              width: `${block.size}px`,
                              height: `${block.size}px`,
                            }}
                            className="bg-primary/20 border border-primary/40 rounded flex items-center justify-center p-2 text-primary font-bold text-xs"
                          >
                            <ImageIcon className="h-1/2 w-1/2 opacity-70" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right Configuration Column (1/3 width) */}
            <div className="w-[35%] flex flex-col bg-card overflow-hidden border-l border-border">
              {/* Right Column Header */}
              <div className="p-4 border-b border-border bg-muted/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">{m.watermark()}</span>
                </div>
              </div>

              {/* Block Selector Navigation Row */}
              <div className="p-3 border-b border-border bg-background flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={blocks.length <= 1}
                    onClick={handlePrevBlock}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-mono">
                        {blocks.length === 0 ? '0 / 0' : `${selectedIndex + 1} / ${blocks.length}`}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {blocks.map((b, idx) => (
                        <DropdownMenuItem
                          key={b.id}
                          onClick={() => setSelectedBlockId(b.id)}
                          className="text-xs flex items-center justify-between cursor-pointer"
                        >
                          <span className="flex items-center gap-2 truncate">
                            {b.type === 'text' ? (
                              <Type className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {b.type === 'text' ? b.text || 'Text' : b.imageAssetId}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground ml-2">
                            #{idx + 1}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={blocks.length <= 1}
                    onClick={handleNextBlock}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  {selectedBlock && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      title={m.delete()}
                      onClick={() => handleDeleteBlock(selectedBlock.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}

                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="h-7 text-xs gap-1">
                        <Plus className="h-3.5 w-3.5" />
                        {m.add()}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={handleAddTextBlock}
                        className="text-xs gap-2 cursor-pointer"
                      >
                        <Type className="h-3.5 w-3.5" />
                        {m.add_text_block()}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleAddImageBlock}
                        className="text-xs gap-2 cursor-pointer"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        {m.add_image_block()}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Property Controls */}
              <ScrollArea className="flex-1 p-4">
                {selectedBlock ? (
                  <div className="space-y-5 text-xs">
                    {/* Block Type Badge */}
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                        {selectedBlock.type === 'text' ? (
                          <Type className="h-4 w-4 text-primary" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-primary" />
                        )}
                        {selectedBlock.type === 'text' ? m.add_text_block() : m.add_image_block()}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        ID: {selectedBlock.id.slice(0, 6)}
                      </span>
                    </div>

                    {/* Text specific fields */}
                    {selectedBlock.type === 'text' && (
                      <div className="space-y-2">
                        <Label className="text-xs">{m.text_content()}</Label>
                        <Input
                          type="text"
                          value={(selectedBlock as WatermarkBlockText).text}
                          onChange={(e) =>
                            handleUpdateBlock(selectedBlock.id, { text: e.target.value })
                          }
                          className="text-xs h-8"
                        />
                      </div>
                    )}

                    {/* Image specific fields */}
                    {selectedBlock.type === 'image' && (
                      <div className="space-y-2">
                        <Label className="text-xs">{m.image_asset_id()}</Label>
                        <Input
                          type="text"
                          value={(selectedBlock as WatermarkBlockImage).imageAssetId}
                          onChange={(e) =>
                            handleUpdateBlock(selectedBlock.id, { imageAssetId: e.target.value })
                          }
                          className="text-xs h-8"
                        />
                      </div>
                    )}

                    {/* Size Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">
                          {selectedBlock.type === 'text' ? m.font_size() : m.image_size()}
                        </Label>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {selectedBlock.size}px
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Slider
                          min={selectedBlock.type === 'text' ? 10 : 20}
                          max={selectedBlock.type === 'text' ? 120 : 500}
                          step={1}
                          value={[selectedBlock.size]}
                          onValueChange={([val]) =>
                            handleUpdateBlock(selectedBlock.id, { size: val })
                          }
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={selectedBlock.size}
                          onChange={(e) =>
                            handleUpdateBlock(selectedBlock.id, {
                              size: Math.max(1, Number(e.target.value)),
                            })
                          }
                          className="w-16 h-7 text-xs font-mono text-right"
                        />
                      </div>
                    </div>

                    {/* Color Control for Text */}
                    {selectedBlock.type === 'text' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{m.color()}</Label>
                          <span className="font-mono text-[11px] text-muted-foreground uppercase">
                            {(selectedBlock as WatermarkBlockText).color}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={(selectedBlock as WatermarkBlockText).color}
                            onChange={(e) =>
                              handleUpdateBlock(selectedBlock.id, { color: e.target.value })
                            }
                            className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent p-0"
                          />
                          <Input
                            type="text"
                            value={(selectedBlock as WatermarkBlockText).color}
                            onChange={(e) =>
                              handleUpdateBlock(selectedBlock.id, { color: e.target.value })
                            }
                            className="flex-1 h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          {[
                            '#FFFFFF',
                            '#000000',
                            '#999999',
                            '#EF4444',
                            '#3B82F6',
                            '#10B981',
                            '#F59E0B',
                          ].map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => handleUpdateBlock(selectedBlock.id, { color: hex })}
                              style={{ backgroundColor: hex }}
                              className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Opacity Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">{m.opacity()}</Label>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {Math.round(selectedBlock.opacity * 100)}%
                        </span>
                      </div>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[selectedBlock.opacity]}
                        onValueChange={([val]) =>
                          handleUpdateBlock(selectedBlock.id, { opacity: val })
                        }
                      />
                    </div>

                    {/* Rotation Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">{m.rotation()}</Label>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {selectedBlock.rotation}°
                        </span>
                      </div>
                      <Slider
                        min={-180}
                        max={180}
                        step={1}
                        value={[selectedBlock.rotation]}
                        onValueChange={([val]) =>
                          handleUpdateBlock(selectedBlock.id, { rotation: val })
                        }
                      />
                      <div className="flex items-center gap-1.5 pt-1">
                        {[-45, -30, 0, 30, 45].map((deg) => (
                          <Button
                            key={deg}
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] flex-1 px-1 font-mono"
                            onClick={() => handleUpdateBlock(selectedBlock.id, { rotation: deg })}
                          >
                            {deg}°
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Position X Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">{m.position_x()}</Label>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {Math.round(selectedBlock.x * 100)}%
                        </span>
                      </div>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[selectedBlock.x]}
                        onValueChange={([val]) => handleUpdateBlock(selectedBlock.id, { x: val })}
                      />
                    </div>

                    {/* Position Y Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">{m.position_y()}</Label>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {Math.round(selectedBlock.y * 100)}%
                        </span>
                      </div>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[selectedBlock.y]}
                        onValueChange={([val]) => handleUpdateBlock(selectedBlock.id, { y: val })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-muted-foreground space-y-3">
                    <p>{m.select_block_to_edit()}</p>
                    <Button size="sm" variant="outline" onClick={handleAddTextBlock}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      {m.add_text_block()}
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Template Mini Modal */}
      <Dialog open={isSaveTemplateOpen} onOpenChange={setIsSaveTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {saveTemplateMode === 'new'
                ? m.create_new_template()
                : m.overwrite_existing_template()}
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 space-y-4 text-xs">
            {saveTemplateMode === 'new' ? (
              <div className="space-y-2">
                <Label>{m.template_name()}</Label>
                <Input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={m.enter_template_name()}
                  className="text-xs"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{m.select_template_to_overwrite()}</Label>
                <select
                  value={targetOverwriteTemplateId || ''}
                  onChange={(e) => setTargetOverwriteTemplateId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setIsSaveTemplateOpen(false)}
            >
              {m.cancel()}
            </Button>
            <Button
              size="sm"
              className="text-xs"
              disabled={isCreatingTemplate || isUpdatingTemplate}
              onClick={handleConfirmSaveTemplate}
            >
              {m.confirm()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}
