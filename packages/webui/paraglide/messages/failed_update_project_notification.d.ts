/**
* | output |
* | --- |
* | "Failed to update project notification settings" |
*
* @param {Failed_Update_Project_NotificationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_update_project_notification: ((inputs?: Failed_Update_Project_NotificationInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Update_Project_NotificationInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Update_Project_NotificationInputs = {};
