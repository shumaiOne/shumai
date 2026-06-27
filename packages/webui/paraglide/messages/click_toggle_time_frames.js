/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Click_Toggle_Time_FramesInputs */

const en_click_toggle_time_frames =
  /** @type {(inputs: Click_Toggle_Time_FramesInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Click to toggle Time/Frames`)
  }

const zh_click_toggle_time_frames =
  /** @type {(inputs: Click_Toggle_Time_FramesInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`点击切换时间/帧`)
  }

/**
 * | output |
 * | --- |
 * | "Click to toggle Time/Frames" |
 *
 * @param {Click_Toggle_Time_FramesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const click_toggle_time_frames =
  /** @type {((inputs?: Click_Toggle_Time_FramesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Click_Toggle_Time_FramesInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_click_toggle_time_frames(inputs)
      return zh_click_toggle_time_frames(inputs)
    }
  )
