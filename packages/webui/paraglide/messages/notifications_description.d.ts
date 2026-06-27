/**
* | output |
* | --- |
* | "Configure your personal notification preferences for this team." |
*
* @param {Notifications_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notifications_description: ((inputs?: Notifications_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Notifications_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Notifications_DescriptionInputs = {};
