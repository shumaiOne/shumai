/**
 * | output |
 * | --- |
 * | "Click to toggle Time/Frames" |
 *
 * @param {Click_Toggle_Time_FramesInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const click_toggle_time_frames: ((
  inputs?: Click_Toggle_Time_FramesInputs,
  options?: {
    locale?: 'en' | 'zh'
  },
) => LocalizedString) &
  import('../runtime.js').MessageMetadata<
    Click_Toggle_Time_FramesInputs,
    {
      locale?: 'en' | 'zh'
    },
    {}
  >
export type LocalizedString = import('../runtime.js').LocalizedString
export type Click_Toggle_Time_FramesInputs = {}
