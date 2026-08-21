/**
* | output |
* | --- |
* | "Select parent tasks..." |
*
* @param {Select_Parent_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_parent_tasks: ((inputs?: Select_Parent_TasksInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_Parent_TasksInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_Parent_TasksInputs = {};
