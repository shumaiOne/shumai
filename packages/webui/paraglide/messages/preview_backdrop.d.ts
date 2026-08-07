/**
* | output |
* | --- |
* | "Preview Background" |
*
* @param {Preview_BackdropInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const preview_backdrop: ((inputs?: Preview_BackdropInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Preview_BackdropInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Preview_BackdropInputs = {};
