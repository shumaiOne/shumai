/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Session_No_Entries_YetInputs */

const en_session_no_entries_yet =
  /** @type {(inputs: Session_No_Entries_YetInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (
      `The session might have been initialized but has not produced any entries yet.`
    )
  }

const zh_session_no_entries_yet =
  /** @type {(inputs: Session_No_Entries_YetInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`该会话可能已初始化但尚未产生任何条目。`)
  }

/**
 * | output |
 * | --- |
 * | "The session might have been initialized but has not produced any entries yet." |
 *
 * @param {Session_No_Entries_YetInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const session_no_entries_yet =
  /** @type {((inputs?: Session_No_Entries_YetInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Session_No_Entries_YetInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_session_no_entries_yet(inputs)
      return zh_session_no_entries_yet(inputs)
    }
  )
