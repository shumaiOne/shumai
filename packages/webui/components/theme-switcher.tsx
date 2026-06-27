import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '../lib/utils'
import { m } from '@/ui/paraglide/messages.js'

type Theme = 'light' | 'dark' | 'system'

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const storedTheme = localStorage.getItem('theme') as Theme | null
    if (storedTheme) {
      setTheme(storedTheme)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    const applyTheme = (newTheme: Theme) => {
      if (newTheme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        root.classList.remove('light', 'dark')
        root.classList.add(systemTheme)
      } else {
        root.classList.remove('light', 'dark')
        root.classList.add(newTheme)
      }
    }

    applyTheme(theme)
    localStorage.setItem('theme', theme)

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme('system')
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme, mounted])

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-sidebar-accent p-1">
        <div className="h-7 w-full rounded-md" />
      </div>
    )
  }

  const options: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: m.light() },
    { value: 'dark', icon: Moon, label: m.dark() },
    { value: 'system', icon: Monitor, label: m.system() },
  ]

  return (
    <div className="space-y-2">
      <div className="px-1 text-xs font-semibold text-sidebar-foreground/60">{m.theme()}</div>
      <div className="flex items-center gap-1 rounded-lg bg-sidebar-accent p-1">
        {options.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              theme === value
                ? 'bg-sidebar text-sidebar-foreground shadow-sm'
                : 'text-sidebar-foreground/60 hover:text-sidebar-foreground',
            )}
            title={label}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
