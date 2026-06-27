/**
* | output |
* | --- |
* | "is not" |
*
* @param {Operator_Is_NotInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const operator_is_not: ((inputs?: Operator_Is_NotInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Operator_Is_NotInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Operator_Is_NotInputs = {};
