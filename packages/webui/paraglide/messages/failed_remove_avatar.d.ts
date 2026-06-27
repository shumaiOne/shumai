/**
* | output |
* | --- |
* | "Failed to remove avatar" |
*
* @param {Failed_Remove_AvatarInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_remove_avatar: ((inputs?: Failed_Remove_AvatarInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Remove_AvatarInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Remove_AvatarInputs = {};
