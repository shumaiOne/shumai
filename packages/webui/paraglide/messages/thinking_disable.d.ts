/**
* | output |
* | --- |
* | "Disable" |
*
* @param {Thinking_DisableInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const thinking_disable: ((inputs?: Thinking_DisableInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Thinking_DisableInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Thinking_DisableInputs = {};
