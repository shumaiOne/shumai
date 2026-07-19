/**
* | output |
* | --- |
* | "Read PDF Pages" |
*
* @param {Agent_Tool_Read_Pdf_Pages_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_read_pdf_pages_name: ((inputs?: Agent_Tool_Read_Pdf_Pages_NameInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Read_Pdf_Pages_NameInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Read_Pdf_Pages_NameInputs = {};
