/**
* | output |
* | --- |
* | "Save Watermark" |
*
* @param {Save_WatermarkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const save_watermark: ((inputs?: Save_WatermarkInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Save_WatermarkInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Save_WatermarkInputs = {};
