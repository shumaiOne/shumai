/**
* | output |
* | --- |
* | "Z → A" |
*
* @param {Sort_Z_To_AInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sort_z_to_a: ((inputs?: Sort_Z_To_AInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sort_Z_To_AInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sort_Z_To_AInputs = {};
