/**
* | output |
* | --- |
* | "Show Cancelled Tasks" |
*
* @param {Show_Cancelled_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const show_cancelled_tasks: ((inputs?: Show_Cancelled_TasksInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Show_Cancelled_TasksInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Show_Cancelled_TasksInputs = {};
