/**
* | output |
* | --- |
* | "Remove Cover" |
*
* @param {Remove_CoverInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const remove_cover: ((inputs?: Remove_CoverInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Remove_CoverInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Remove_CoverInputs = {};
