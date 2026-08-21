/**
* | output |
* | --- |
* | "{creator} deleted task {task}" |
*
* @param {Notification_Kanban_Task_DeletedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_kanban_task_deleted: ((inputs: Notification_Kanban_Task_DeletedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Notification_Kanban_Task_DeletedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Notification_Kanban_Task_DeletedInputs = {
    creator: NonNullable<unknown>;
    task: NonNullable<unknown>;
};
