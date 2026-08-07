/**
* | output |
* | --- |
* | "16:9 Widescreen" |
*
* @param {Aspect_16_9Inputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const aspect_16_9: ((inputs?: Aspect_16_9Inputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Aspect_16_9Inputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Aspect_16_9Inputs = {};
