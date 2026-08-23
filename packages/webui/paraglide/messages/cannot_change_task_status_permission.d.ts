/**
* | output |
* | --- |
* | "Only team owners, task reporters, or assignees can change task status" |
*
* @param {Cannot_Change_Task_Status_PermissionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cannot_change_task_status_permission: ((inputs?: Cannot_Change_Task_Status_PermissionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Cannot_Change_Task_Status_PermissionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Cannot_Change_Task_Status_PermissionInputs = {};
