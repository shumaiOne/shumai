/**
* | output |
* | --- |
* | "Executed autonomously by an AI agent" |
*
* @param {Task_Type_Agent_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_type_agent_desc: ((inputs?: Task_Type_Agent_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Task_Type_Agent_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Task_Type_Agent_DescInputs = {};
