/**
* | output |
* | --- |
* | "4:3 Standard" |
*
* @param {Aspect_4_3Inputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const aspect_4_3: ((inputs?: Aspect_4_3Inputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Aspect_4_3Inputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Aspect_4_3Inputs = {};
