/**
* | output |
* | --- |
* | "Type your query above and click the Search button to display results." |
*
* @param {Type_Query_InstructionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const type_query_instruction: ((inputs?: Type_Query_InstructionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Type_Query_InstructionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Type_Query_InstructionInputs = {};
