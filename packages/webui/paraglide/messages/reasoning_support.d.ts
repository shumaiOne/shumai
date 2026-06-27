/**
* | output |
* | --- |
* | "Reasoning Support" |
*
* @param {Reasoning_SupportInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const reasoning_support: ((inputs?: Reasoning_SupportInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Reasoning_SupportInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Reasoning_SupportInputs = {};
