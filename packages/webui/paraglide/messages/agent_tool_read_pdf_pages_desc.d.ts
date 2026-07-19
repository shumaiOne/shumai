/**
* | output |
* | --- |
* | "Allows the agent to convert and view specific pages of a PDF document as images." |
*
* @param {Agent_Tool_Read_Pdf_Pages_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_tool_read_pdf_pages_desc: ((inputs?: Agent_Tool_Read_Pdf_Pages_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agent_Tool_Read_Pdf_Pages_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agent_Tool_Read_Pdf_Pages_DescInputs = {};
