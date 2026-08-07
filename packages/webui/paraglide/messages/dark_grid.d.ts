/**
* | output |
* | --- |
* | "Dark Grid" |
*
* @param {Dark_GridInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const dark_grid: ((inputs?: Dark_GridInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Dark_GridInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Dark_GridInputs = {};
