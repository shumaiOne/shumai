/**
* | output |
* | --- |
* | "Enter your new password below." |
*
* @param {Reset_Password_SubtitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const reset_password_subtitle: ((inputs?: Reset_Password_SubtitleInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Reset_Password_SubtitleInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Reset_Password_SubtitleInputs = {};
