/**
* | output |
* | --- |
* | "Manage notifications related to file uploads and metadata field status updates." |
*
* @param {Assets_Notification_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const assets_notification_description: ((inputs?: Assets_Notification_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Assets_Notification_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Assets_Notification_DescriptionInputs = {};
