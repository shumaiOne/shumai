/**
* | output |
* | --- |
* | "Thinking..." |
*
* @param {Thinking_StatusInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const thinking_status: ((inputs?: Thinking_StatusInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Thinking_StatusInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Thinking_StatusInputs = {};
