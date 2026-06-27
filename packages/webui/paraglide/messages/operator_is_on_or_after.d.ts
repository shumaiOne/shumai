/**
* | output |
* | --- |
* | "is on or after" |
*
* @param {Operator_Is_On_Or_AfterInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const operator_is_on_or_after: ((inputs?: Operator_Is_On_Or_AfterInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Operator_Is_On_Or_AfterInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Operator_Is_On_Or_AfterInputs = {};
