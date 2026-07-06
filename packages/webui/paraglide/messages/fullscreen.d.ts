/**
* | output |
* | --- |
* | "Fullscreen" |
*
* @param {FullscreenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const fullscreen: ((inputs?: FullscreenInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<FullscreenInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type FullscreenInputs = {};
