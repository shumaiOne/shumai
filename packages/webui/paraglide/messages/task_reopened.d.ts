/**
* | output |
* | --- |
* | "Task reopened" |
*
* @param {Task_ReopenedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_reopened: ((inputs?: Task_ReopenedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Task_ReopenedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Task_ReopenedInputs = {};
