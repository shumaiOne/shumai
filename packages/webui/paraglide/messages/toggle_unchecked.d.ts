/**
* | output |
* | --- |
* | "Unchecked" |
*
* @param {Toggle_UncheckedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const toggle_unchecked: ((inputs?: Toggle_UncheckedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Toggle_UncheckedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Toggle_UncheckedInputs = {};
