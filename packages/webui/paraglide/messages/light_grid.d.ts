/**
* | output |
* | --- |
* | "Light Grid" |
*
* @param {Light_GridInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const light_grid: ((inputs?: Light_GridInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Light_GridInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Light_GridInputs = {};
