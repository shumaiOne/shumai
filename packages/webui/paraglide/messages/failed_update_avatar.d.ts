/**
* | output |
* | --- |
* | "Failed to update avatar" |
*
* @param {Failed_Update_AvatarInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_update_avatar: ((inputs?: Failed_Update_AvatarInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Update_AvatarInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Update_AvatarInputs = {};
