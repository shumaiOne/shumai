export type LocalizedString = import('../runtime.js').LocalizedString
export type _NewInputs = {}
/**
 * | output |
 * | --- |
 * | "New" |
 *
 * @param {_NewInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
declare const _new: ((
  inputs?: _NewInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    _NewInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export { _new as 'new' }
