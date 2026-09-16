function patchSpSearchConstructor(constructor: CustomElementConstructor) {
  type LitCustomElement = {
    connectedCallback?: (this: HTMLElement) => void
    firstUpdated?: (this: HTMLElement, changedProperties: unknown) => void
    updated?: (this: HTMLElement, changedProperties: unknown) => void
  }
  const proto = constructor.prototype as LitCustomElement & HTMLElement
  if ((proto as unknown as { shumaiSearchPatched?: boolean }).shumaiSearchPatched) {
    return
  }
  ;(proto as unknown as { shumaiSearchPatched?: boolean }).shumaiSearchPatched = true

  const applySearchDomFix = (instance: HTMLElement) => {
    const root = instance.shadowRoot
    if (!root) return

    const textfield = root.querySelector('#textfield') as HTMLElement | null
    const form = root.querySelector('#form') as HTMLElement | null
    const input = (root.querySelector('input.input') ||
      root.querySelector('.input') ||
      root.querySelector('input')) as HTMLInputElement | null
    const button = root.querySelector('#button') as HTMLElement | null

    if (textfield) {
      textfield.style.width = '100%'
      textfield.style.cursor = 'text'
    }
    if (form) {
      form.style.width = '100%'
      form.style.display = 'flex'
      form.style.alignItems = 'center'
      form.style.flex = '1'
      form.style.minWidth = '0'
    }
    if (input) {
      input.style.width = '100%'
      input.style.flex = '1'
      input.style.minWidth = '0'
      input.style.cursor = 'text'
      input.style.boxSizing = 'border-box'
    }
    if (button) {
      button.style.flexShrink = '0'
    }
  }

  const origConnectedCallback = proto.connectedCallback
  proto.connectedCallback = function (this: HTMLElement) {
    origConnectedCallback?.call(this)

    // Forward clicks to inner input
    this.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest('#button') && !target?.closest('sp-clear-button')) {
        const input = (this.shadowRoot?.querySelector('input') ||
          (this as unknown as { focusElement?: HTMLElement }).focusElement) as HTMLElement | null
        input?.focus?.()
      }
    })

    applySearchDomFix(this)
  }

  const origFirstUpdated = proto.firstUpdated
  proto.firstUpdated = function (this: HTMLElement, changedProperties: unknown) {
    origFirstUpdated?.call(this, changedProperties)
    applySearchDomFix(this)
  }

  const origUpdated = proto.updated
  proto.updated = function (this: HTMLElement, changedProperties: unknown) {
    origUpdated?.call(this, changedProperties)
    applySearchDomFix(this)
  }
}

// Guard against duplicate custom element registrations during UXP development and plugin reload
if (typeof window !== 'undefined' && window.customElements) {
  const existingSpSearch = window.customElements.get('sp-search')
  if (existingSpSearch) {
    patchSpSearchConstructor(existingSpSearch)
  }

  const origDefine = window.customElements.define.bind(window.customElements)
  window.customElements.define = (
    name: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions,
  ) => {
    if (name === 'sp-search') {
      patchSpSearchConstructor(constructor)
    }

    if (window.customElements.get(name)) {
      return
    }

    origDefine(name, constructor, options)
  }
}

// Polyfill window.matchMedia for Adobe UXP environment
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => {
    const mql: MediaQueryList = {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }
    return mql
  }
}
