import { MAX_SEARCH_IMAGE_BASE64_LENGTH } from '@shumai/dtos'
import { ImagePlus, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ulid } from 'ulid'
import { Button } from '@/ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/components/ui/dialog'
import { m } from '@/ui/paraglide/messages.js'

export interface SearchImage {
  id: string
  name: string
  base64: string
}

async function resizeImage(file: File): Promise<SearchImage> {
  if (file.type && !file.type.startsWith('image/')) throw new Error('Invalid file type')

  const bitmap = await createImageBitmap(file)
  try {
    const landscape = bitmap.width >= bitmap.height
    const scale = Math.min(
      1,
      (landscape ? 1280 : 720) / bitmap.width,
      (landscape ? 720 : 1280) / bitmap.height,
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to resize image')

    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const base64 = dataUrl.split(',')[1]
    if (!base64 || base64.length > MAX_SEARCH_IMAGE_BASE64_LENGTH) {
      throw new Error('Invalid resized image')
    }
    return { id: ulid(), name: file.name, base64 }
  } finally {
    bitmap.close()
  }
}

export function SearchImagePicker({ onSelect }: { onSelect: (image: SearchImage) => void }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)
  const [processing, setProcessing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const pending = useRef<AbortController | null>(null)

  useEffect(() => () => pending.current?.abort(), [])

  function setPickerOpen(next: boolean) {
    if (!next) {
      pending.current?.abort()
      pending.current = null
      setError(false)
      setProcessing(false)
    }
    setOpen(next)
  }

  async function selectFile(file: File) {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setError(false)
    setProcessing(true)
    try {
      const image = await resizeImage(file)
      if (controller.signal.aborted) return
      onSelect(image)
      setPickerOpen(false)
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setProcessing(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setPickerOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={m.image_search_attach()}>
          <ImagePlus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.image_search_attach()}</DialogTitle>
          <DialogDescription>{m.image_search_select_description()}</DialogDescription>
        </DialogHeader>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void selectFile(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-28 w-full border-dashed"
          disabled={processing}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const files = event.dataTransfer.files
            if (files.length === 1) void selectFile(files[0])
            else setError(true)
          }}
        >
          {processing && <Loader2 className="size-4 animate-spin" />}
          {m.image_search_choose_image()}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {m.image_search_invalid_image()}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
