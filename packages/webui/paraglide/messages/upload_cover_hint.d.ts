/**
* | output |
* | --- |
* | "Drag and drop, or browse. Recommended 1:1 (400×400px)." |
*
* @param {Upload_Cover_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const upload_cover_hint: ((inputs?: Upload_Cover_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Upload_Cover_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Upload_Cover_HintInputs = {};
