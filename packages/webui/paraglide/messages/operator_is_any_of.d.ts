/**
* | output |
* | --- |
* | "is any of" |
*
* @param {Operator_Is_Any_OfInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const operator_is_any_of: ((inputs?: Operator_Is_Any_OfInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Operator_Is_Any_OfInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Operator_Is_Any_OfInputs = {};
