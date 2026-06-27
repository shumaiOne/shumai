/**
* | output |
* | --- |
* | "Balanced thought" |
*
* @param {Balanced_ThoughtInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const balanced_thought: ((inputs?: Balanced_ThoughtInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Balanced_ThoughtInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Balanced_ThoughtInputs = {};
