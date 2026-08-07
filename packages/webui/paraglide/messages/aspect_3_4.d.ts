/**
* | output |
* | --- |
* | "3:4 Portrait" |
*
* @param {Aspect_3_4Inputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const aspect_3_4: ((inputs?: Aspect_3_4Inputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Aspect_3_4Inputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Aspect_3_4Inputs = {};
