// Guard against duplicate custom element registrations during UXP development and plugin reload
if (typeof window !== 'undefined' && window.customElements) {
  const origDefine = window.customElements.define.bind(window.customElements)
  window.customElements.define = (
    name: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions,
  ) => {
    if (window.customElements.get(name)) {
      return
    }

    if (name === 'sp-search') {
      // In Adobe UXP, sp-search's internal <input> and <form> inside Shadow DOM do not stretch to 100% width,
      // and #textfield lacks cursor: text and click-to-focus forwarding.
      type CustomElementWithLifecycle = {
        connectedCallback?: (this: HTMLElement & { focus?: () => void }) => void
      }
      const proto = constructor.prototype as CustomElementWithLifecycle
      const origConnectedCallback = proto.connectedCallback
      proto.connectedCallback = function (this: HTMLElement & { focus?: () => void }) {
        origConnectedCallback?.call(this)

        // Forward clicks anywhere in the search box to focus the input
        this.addEventListener('click', (e: MouseEvent) => {
          const target = e.target as HTMLElement | null
          if (!target?.closest('#button') && !target?.closest('sp-clear-button')) {
            this.focus?.()
          }
        })

        // Force Shadow DOM elements to stretch full width and show text cursor
        if (this.shadowRoot && !this.shadowRoot.querySelector('style[data-shumai-search-fix]')) {
          const style = document.createElement('style')
          style.setAttribute('data-shumai-search-fix', 'true')
          style.textContent = `
            #textfield { width: 100% !important; cursor: text !important; }
            #form { width: 100% !important; display: flex !important; align-items: center !important; }
            .input { width: 100% !important; flex: 1 !important; cursor: text !important; }
          `
          this.shadowRoot.appendChild(style)
        }
      }
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
