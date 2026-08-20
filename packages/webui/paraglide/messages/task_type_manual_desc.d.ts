/**
* | output |
* | --- |
* | "Performed or managed by a team member" |
*
* @param {Task_Type_Manual_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_type_manual_desc: ((inputs?: Task_Type_Manual_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Task_Type_Manual_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Task_Type_Manual_DescInputs = {};
