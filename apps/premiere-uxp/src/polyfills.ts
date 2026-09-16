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
