/**
 * | output |
 * | --- |
 * | "If left empty, the value will be read from the host machine's environment." |
 *
 * @param {Env_Var_Empty_NoteInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const env_var_empty_note: ((
  inputs?: Env_Var_Empty_NoteInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Env_Var_Empty_NoteInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Env_Var_Empty_NoteInputs = {}
