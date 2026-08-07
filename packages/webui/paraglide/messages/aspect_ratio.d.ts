/**
* | output |
* | --- |
* | "Aspect Ratio" |
*
* @param {Aspect_RatioInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const aspect_ratio: ((inputs?: Aspect_RatioInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Aspect_RatioInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Aspect_RatioInputs = {};
