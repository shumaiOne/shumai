/**
* | output |
* | --- |
* | "Playback Speed" |
*
* @param {Playback_SpeedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const playback_speed: ((inputs?: Playback_SpeedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Playback_SpeedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Playback_SpeedInputs = {};
