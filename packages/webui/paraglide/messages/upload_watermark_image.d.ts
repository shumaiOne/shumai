/**
* | output |
* | --- |
* | "Upload Watermark Image" |
*
* @param {Upload_Watermark_ImageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const upload_watermark_image: ((inputs?: Upload_Watermark_ImageInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Upload_Watermark_ImageInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Upload_Watermark_ImageInputs = {};
