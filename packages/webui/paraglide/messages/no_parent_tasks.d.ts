/**
* | output |
* | --- |
* | "No parent tasks" |
*
* @param {No_Parent_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_parent_tasks: ((inputs?: No_Parent_TasksInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Parent_TasksInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Parent_TasksInputs = {};
