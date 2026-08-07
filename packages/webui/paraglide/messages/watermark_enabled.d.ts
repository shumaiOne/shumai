/**
* | output |
* | --- |
* | "Enable Watermark" |
*
* @param {Watermark_EnabledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark_enabled: ((inputs?: Watermark_EnabledInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Watermark_EnabledInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Watermark_EnabledInputs = {};
