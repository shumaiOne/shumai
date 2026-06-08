import { ShumaiLogo } from '@/ui/components/ui/icons'
import { CheckCircle2 } from 'lucide-react'
import { ReactNode } from 'react'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 bg-zinc-100/80 dark:bg-black font-sans overflow-hidden relative">
      {/* Drifting Background Mesh Blobs */}
      <div className="bg-rose-500/10 dark:bg-rose-600/5 w-[600px] h-[600px] rounded-full blur-[140px] absolute top-[-10%] left-[-10%] animate-drift-slow" />
      <div className="bg-orange-500/10 dark:bg-orange-600/5 w-[600px] h-[600px] rounded-full blur-[140px] absolute bottom-[-10%] right-[-10%] animate-drift-medium" />

      {/* Main Glassmorphic Split-Pane Card */}
      <div className="relative max-w-4xl w-full flex flex-col md:flex-row rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl bg-white dark:bg-zinc-900 overflow-hidden min-h-[580px] z-10 transition-all duration-300 hover:shadow-rose-500/5">
        {/* Left Pane (Brand Showcase) */}
        <div className="hidden md:flex flex-col w-full md:w-1/2 bg-gradient-to-br from-rose-500/15 via-orange-500/10 to-amber-500/5 dark:from-rose-950/30 dark:via-orange-950/15 dark:to-zinc-900/40 p-8 md:p-12 justify-between border-r border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
          {/* Subtle Grid Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

          {/* Logo & Brand */}
          <div className="relative flex items-center gap-3">
            <ShumaiLogo className="h-12 w-12 shadow-lg shadow-rose-500/10 rounded-2xl transition-transform duration-500 hover:scale-105" />
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
              Shumai
            </span>
          </div>

          {/* Marketing Copy / Feature Points */}
          <div className="relative my-8 md:my-0 space-y-6">
            <h2 className="text-3xl font-extrabold tracking-tight leading-tight text-zinc-900 dark:text-zinc-50">
              One workspace
              <br />
              for all your
              <br />
              <span className="bg-gradient-to-r from-rose-500 to-orange-500 bg-clip-text text-transparent">
                creative assets.
              </span>
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed max-w-sm">
              Upload and index your files, enrich them with custom metadata schemas, draw
              annotations directly on media, and gather instant feedback — all in one modern
              workspace built for creators.
            </p>

            <ul className="space-y-3.5 pt-4">
              {[
                'Instant asset uploads & high-fidelity media players',
                'Custom metadata schemas & drawing canvas reviews',
                'Frictionless team workspaces & secure sharing',
              ].map((text, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300 font-medium"
                >
                  <CheckCircle2 className="w-5 h-5 text-rose-500 flex-shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer Label */}
          <div className="relative pt-4 border-t border-zinc-200/30 dark:border-zinc-800/30">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Join our community of developers and designers.
            </p>
          </div>
        </div>

        {/* Right Pane (Form Container) */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">{children}</div>
      </div>
    </div>
  )
}
