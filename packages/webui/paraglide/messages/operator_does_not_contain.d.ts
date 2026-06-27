/**
* | output |
* | --- |
* | "does not contain" |
*
* @param {Operator_Does_Not_ContainInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const operator_does_not_contain: ((inputs?: Operator_Does_Not_ContainInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Operator_Does_Not_ContainInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Operator_Does_Not_ContainInputs = {};
