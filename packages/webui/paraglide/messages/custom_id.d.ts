/**
* | output |
* | --- |
* | "Custom ID" |
*
* @param {Custom_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const custom_id: ((inputs?: Custom_IdInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Custom_IdInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Custom_IdInputs = {};
