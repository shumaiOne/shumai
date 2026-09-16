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
