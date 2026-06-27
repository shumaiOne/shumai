/**
* | output |
* | --- |
* | "Cover Preview" |
*
* @param {Cover_PreviewInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cover_preview: ((inputs?: Cover_PreviewInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Cover_PreviewInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Cover_PreviewInputs = {};
