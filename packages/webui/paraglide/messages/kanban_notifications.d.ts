/**
* | output |
* | --- |
* | "Kanban Notifications" |
*
* @param {Kanban_NotificationsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const kanban_notifications: ((inputs?: Kanban_NotificationsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Kanban_NotificationsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Kanban_NotificationsInputs = {};
