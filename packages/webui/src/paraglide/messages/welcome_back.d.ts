/**
* | output |
* | --- |
* | "Welcome Back" |
*
* @param {Welcome_BackInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const welcome_back: ((inputs?: Welcome_BackInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Welcome_BackInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Welcome_BackInputs = {};
