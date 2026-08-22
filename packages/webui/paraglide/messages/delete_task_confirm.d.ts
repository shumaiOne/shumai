/**
* | output |
* | --- |
* | "Are you sure you want to delete task \"{title}\"? This action cannot be undone." |
*
* @param {Delete_Task_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_task_confirm: ((inputs: Delete_Task_ConfirmInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Delete_Task_ConfirmInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Delete_Task_ConfirmInputs = {
    title: NonNullable<unknown>;
};
