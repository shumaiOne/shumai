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

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      'sp-icon': SpIconCustomElementProps
      'sp-icon-refresh': SpIconCustomElementProps
      'sp-icon-chevron-down': SpIconCustomElementProps
      'sp-icon-chevron-right': SpIconCustomElementProps
      'sp-icon-log-out': SpIconCustomElementProps
      'sp-icon-arrow-right': SpIconCustomElementProps
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
  }
}
