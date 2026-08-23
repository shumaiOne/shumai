/**
* | output |
* | --- |
* | "No tasks linked to this asset" |
*
* @param {No_Linked_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_linked_tasks: ((inputs?: No_Linked_TasksInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Linked_TasksInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Linked_TasksInputs = {};
