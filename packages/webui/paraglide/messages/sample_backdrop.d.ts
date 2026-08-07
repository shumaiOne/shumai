/**
* | output |
* | --- |
* | "Sample Media" |
*
* @param {Sample_BackdropInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sample_backdrop: ((inputs?: Sample_BackdropInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sample_BackdropInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sample_BackdropInputs = {};
