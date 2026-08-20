/**
* | output |
* | --- |
* | "Task unblocked" |
*
* @param {Task_UnblockedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_unblocked: ((inputs?: Task_UnblockedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Task_UnblockedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Task_UnblockedInputs = {};
