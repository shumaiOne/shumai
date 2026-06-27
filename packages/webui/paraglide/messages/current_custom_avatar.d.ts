/**
* | output |
* | --- |
* | "Current Custom Avatar" |
*
* @param {Current_Custom_AvatarInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const current_custom_avatar: ((inputs?: Current_Custom_AvatarInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Current_Custom_AvatarInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Current_Custom_AvatarInputs = {};
