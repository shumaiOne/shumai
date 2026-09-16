/* eslint-disable @typescript-eslint/naming-convention -- Custom element tag names in IntrinsicElements require hyphens */
declare module '@swc-uxp-wrappers/utils' {
  export const aliases: Record<string, string>
}

type SpIconCustomElementProps = import('react').DetailedHTMLProps<
  import('react').HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  size?: 'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl'
  slot?: string
  name?: string
  label?: string
}

type SpButtonCustomElementProps = import('react').DetailedHTMLProps<
  import('react').ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> & {
  variant?: 'accent' | 'primary' | 'secondary' | 'negative' | 'white' | 'black' | string
  treatment?: 'fill' | 'outline' | string
  quiet?: boolean
  size?: 'xs' | 's' | 'm' | 'l' | 'xl'
  label?: string
  'icon-only'?: boolean
  disabled?: boolean
  slot?: string
}

type SpButtonGroupCustomElementProps = import('react').DetailedHTMLProps<
  import('react').HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  vertical?: boolean
  size?: 'xs' | 's' | 'm' | 'l' | 'xl'
}

type SpActionButtonCustomElementProps = import('react').DetailedHTMLProps<
  import('react').ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> & {
  quiet?: boolean
  size?: 'xs' | 's' | 'm' | 'l' | 'xl'
  label?: string
  disabled?: boolean
  selected?: boolean
  toggles?: boolean
  emphasized?: boolean
  slot?: string
}

type SpActionMenuCustomElementProps = import('react').DetailedHTMLProps<
  import('react').HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  quiet?: boolean
  size?: 'xs' | 's' | 'm' | 'l' | 'xl'
  label?: string
  disabled?: boolean
  open?: boolean
  placement?:
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'right'
    | 'right-start'
    | 'right-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end'
  'force-popover'?: boolean
  selects?: 'single'
  value?: string
  slot?: string
}

type SpMenuCustomElementProps = import('react').DetailedHTMLProps<
  import('react').HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  slot?: string
  selects?: 'single' | 'multiple' | 'inherit'
  label?: string
}

type SpMenuItemCustomElementProps = import('react').DetailedHTMLProps<
  import('react').HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  disabled?: boolean
  selected?: boolean
  value?: string
  slot?: string
}

type SpMenuDividerCustomElementProps = import('react').DetailedHTMLProps<
  import('react').HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  size?: 's' | 'm' | 'l'
}

type SpMenuGroupCustomElementProps = import('react').DetailedHTMLProps<
  import('react').HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  slot?: string
}

type SpStatusLightCustomElementProps = import('react').DetailedHTMLProps<
  import('react').HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  variant?:
    | 'negative'
    | 'notice'
    | 'positive'
    | 'info'
    | 'neutral'
    | 'yellow'
    | 'fuchsia'
    | 'indigo'
    | 'seafoam'
    | 'chartreuse'
    | 'magenta'
    | 'celery'
    | 'purple'
    | string
  disabled?: boolean
  slot?: string
}

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      'sp-icon': SpIconCustomElementProps
      'sp-icon-refresh': SpIconCustomElementProps
      'sp-icon-chevron-down': SpIconCustomElementProps
      'sp-icon-chevron-right': SpIconCustomElementProps
      'sp-icon-log-out': SpIconCustomElementProps
      'sp-icon-arrow-right': SpIconCustomElementProps
      'sp-button': SpButtonCustomElementProps
      'sp-button-group': SpButtonGroupCustomElementProps
      'sp-action-button': SpActionButtonCustomElementProps
      'sp-action-menu': SpActionMenuCustomElementProps
      'sp-menu': SpMenuCustomElementProps
      'sp-menu-item': SpMenuItemCustomElementProps
      'sp-menu-divider': SpMenuDividerCustomElementProps
      'sp-menu-group': SpMenuGroupCustomElementProps
      'sp-status-light': SpStatusLightCustomElementProps
    }
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    'sp-icon': SpIconCustomElementProps
    'sp-icon-refresh': SpIconCustomElementProps
    'sp-icon-chevron-down': SpIconCustomElementProps
    'sp-icon-chevron-right': SpIconCustomElementProps
    'sp-icon-log-out': SpIconCustomElementProps
    'sp-icon-arrow-right': SpIconCustomElementProps
    'sp-button': SpButtonCustomElementProps
    'sp-button-group': SpButtonGroupCustomElementProps
    'sp-action-button': SpActionButtonCustomElementProps
    'sp-action-menu': SpActionMenuCustomElementProps
    'sp-menu': SpMenuCustomElementProps
    'sp-menu-item': SpMenuItemCustomElementProps
    'sp-menu-divider': SpMenuDividerCustomElementProps
    'sp-menu-group': SpMenuGroupCustomElementProps
    'sp-status-light': SpStatusLightCustomElementProps
  }
}

interface UxpFileEntry {
  readonly isFile: true
  readonly isFolder: false
  readonly name: string
  readonly nativePath: string
  write(data: ArrayBuffer | string, options?: { format?: unknown; append?: boolean }): Promise<void>
}

interface UxpFolderEntry {
  readonly isFile: false
  readonly isFolder: true
  readonly name: string
  readonly nativePath: string
  createFile(name: string, options?: { overwrite?: boolean }): Promise<UxpFileEntry>
  getFiles(): Promise<UxpFileEntry[]>
}

interface UxpLocalFileSystem {
  getFileForSaving(
    defaultName?: string,
    options?: { types?: string[] },
  ): Promise<UxpFileEntry | null>
  getFileForOpening(options?: {
    allowMultiple?: boolean
    types?: string[]
  }): Promise<UxpFileEntry | UxpFileEntry[] | null>
  getFolder(): Promise<UxpFolderEntry | null>
  getTemporaryFolder(): Promise<UxpFolderEntry>
  getDataFolder(): Promise<UxpFolderEntry>
  getPluginFolder(): Promise<UxpFolderEntry>
}

interface UxpStorageFormats {
  readonly binary: unknown
  readonly utf8: unknown
}

interface UxpModule {
  storage: {
    localFileSystem: UxpLocalFileSystem
    formats: UxpStorageFormats
  }
}

declare module 'uxp' {
  const uxp: UxpModule
  export = uxp
}
