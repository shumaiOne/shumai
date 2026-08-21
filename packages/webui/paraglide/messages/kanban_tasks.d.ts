/**
* | output |
* | --- |
* | "Kanban Tasks" |
*
* @param {Kanban_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const kanban_tasks: ((inputs?: Kanban_TasksInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Kanban_TasksInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Kanban_TasksInputs = {};
