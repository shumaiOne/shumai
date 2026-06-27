/**
* | output |
* | --- |
* | "is within" |
*
* @param {Operator_Is_WithinInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const operator_is_within: ((inputs?: Operator_Is_WithinInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Operator_Is_WithinInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Operator_Is_WithinInputs = {};
