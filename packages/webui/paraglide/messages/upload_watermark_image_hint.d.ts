/**
* | output |
* | --- |
* | "Drag and drop, or browse. Max 1MB." |
*
* @param {Upload_Watermark_Image_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const upload_watermark_image_hint: ((inputs?: Upload_Watermark_Image_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Upload_Watermark_Image_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Upload_Watermark_Image_HintInputs = {};
