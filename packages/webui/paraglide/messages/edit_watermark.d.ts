/**
* | output |
* | --- |
* | "Edit Watermark" |
*
* @param {Edit_WatermarkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const edit_watermark: ((inputs?: Edit_WatermarkInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Edit_WatermarkInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Edit_WatermarkInputs = {};
