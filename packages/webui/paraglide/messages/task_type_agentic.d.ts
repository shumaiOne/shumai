/**
* | output |
* | --- |
* | "Agentic Task" |
*
* @param {Task_Type_AgenticInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_type_agentic: ((inputs?: Task_Type_AgenticInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Task_Type_AgenticInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Task_Type_AgenticInputs = {};
