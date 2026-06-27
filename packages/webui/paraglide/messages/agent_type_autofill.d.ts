/**
* | output |
* | --- |
* | "Autofill" |
*
* @param {Agent_Type_AutofillInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_type_autofill: ((inputs?: Agent_Type_AutofillInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Type_AutofillInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Type_AutofillInputs = {};
