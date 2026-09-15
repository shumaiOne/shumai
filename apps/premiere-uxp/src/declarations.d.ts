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
  }
}
