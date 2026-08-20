/**
* | output |
* | --- |
* | "Task approved" |
*
* @param {Task_ApprovedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_approved: ((inputs?: Task_ApprovedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Task_ApprovedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Task_ApprovedInputs = {};
