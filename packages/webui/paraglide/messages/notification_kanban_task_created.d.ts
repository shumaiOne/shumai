/**
* | output |
* | --- |
* | "{creator} created task {task}" |
*
* @param {Notification_Kanban_Task_CreatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_kanban_task_created: ((inputs: Notification_Kanban_Task_CreatedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Notification_Kanban_Task_CreatedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Notification_Kanban_Task_CreatedInputs = {
    creator: NonNullable<unknown>;
    task: NonNullable<unknown>;
};
