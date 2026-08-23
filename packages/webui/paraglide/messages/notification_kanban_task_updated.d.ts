/**
* | output |
* | --- |
* | "{creator} updated task {task}" |
*
* @param {Notification_Kanban_Task_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_kanban_task_updated: ((inputs: Notification_Kanban_Task_UpdatedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Notification_Kanban_Task_UpdatedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Notification_Kanban_Task_UpdatedInputs = {
    creator: NonNullable<unknown>;
    task: NonNullable<unknown>;
};
