/**
* | output |
* | --- |
* | "Task cancelled" |
*
* @param {Task_CancelledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_cancelled: ((inputs?: Task_CancelledInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Task_CancelledInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Task_CancelledInputs = {};
