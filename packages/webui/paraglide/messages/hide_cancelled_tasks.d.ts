/**
* | output |
* | --- |
* | "Hide Cancelled Tasks" |
*
* @param {Hide_Cancelled_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hide_cancelled_tasks: ((inputs?: Hide_Cancelled_TasksInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Hide_Cancelled_TasksInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Hide_Cancelled_TasksInputs = {};
