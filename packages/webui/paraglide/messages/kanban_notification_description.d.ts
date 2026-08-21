/**
* | output |
* | --- |
* | "Manage notifications for Kanban board tasks and comments." |
*
* @param {Kanban_Notification_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const kanban_notification_description: ((inputs?: Kanban_Notification_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Kanban_Notification_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Kanban_Notification_DescriptionInputs = {};
