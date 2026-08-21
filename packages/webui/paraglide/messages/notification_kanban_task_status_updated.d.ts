/**
* | output |
* | --- |
* | "{creator} updated status of task {task}" |
*
* @param {Notification_Kanban_Task_Status_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_kanban_task_status_updated: ((inputs: Notification_Kanban_Task_Status_UpdatedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Notification_Kanban_Task_Status_UpdatedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Notification_Kanban_Task_Status_UpdatedInputs = {
    creator: NonNullable<unknown>;
    task: NonNullable<unknown>;
};
