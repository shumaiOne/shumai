/**
* | output |
* | --- |
* | "No watermark blocks added yet" |
*
* @param {No_Watermark_BlocksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_watermark_blocks: ((inputs?: No_Watermark_BlocksInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Watermark_BlocksInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Watermark_BlocksInputs = {};
