/**
* | output |
* | --- |
* | "{creator} commented on task {task}" |
*
* @param {Notification_Kanban_Task_Comment_CreatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_kanban_task_comment_created: ((inputs: Notification_Kanban_Task_Comment_CreatedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Notification_Kanban_Task_Comment_CreatedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Notification_Kanban_Task_Comment_CreatedInputs = {
    creator: NonNullable<unknown>;
    task: NonNullable<unknown>;
};
