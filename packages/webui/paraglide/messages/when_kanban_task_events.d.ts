/**
* | output |
* | --- |
* | "When tasks are created, assigned, updated, or deleted" |
*
* @param {When_Kanban_Task_EventsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const when_kanban_task_events: ((inputs?: When_Kanban_Task_EventsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<When_Kanban_Task_EventsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type When_Kanban_Task_EventsInputs = {};
