/**
* | output |
* | --- |
* | "{creator} assigned you to task {task}" |
*
* @param {Notification_Kanban_Task_AssignedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_kanban_task_assigned: ((inputs: Notification_Kanban_Task_AssignedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Notification_Kanban_Task_AssignedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Notification_Kanban_Task_AssignedInputs = {
    creator: NonNullable<unknown>;
    task: NonNullable<unknown>;
};
