/**
* | output |
* | --- |
* | "Parent Tasks" |
*
* @param {Parent_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const parent_tasks: ((inputs?: Parent_TasksInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Parent_TasksInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Parent_TasksInputs = {};
