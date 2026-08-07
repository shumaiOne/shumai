/**
* | output |
* | --- |
* | "Watermark updated successfully" |
*
* @param {Watermark_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark_updated: ((inputs?: Watermark_UpdatedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Watermark_UpdatedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Watermark_UpdatedInputs = {};
