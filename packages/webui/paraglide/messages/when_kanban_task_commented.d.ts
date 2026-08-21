/**
* | output |
* | --- |
* | "When someone comments on a task" |
*
* @param {When_Kanban_Task_CommentedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const when_kanban_task_commented: ((inputs?: When_Kanban_Task_CommentedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<When_Kanban_Task_CommentedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type When_Kanban_Task_CommentedInputs = {};
