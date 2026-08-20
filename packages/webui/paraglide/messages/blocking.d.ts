/**
* | output |
* | --- |
* | "Blocking (Dependents)" |
*
* @param {BlockingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const blocking: ((inputs?: BlockingInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<BlockingInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type BlockingInputs = {};
