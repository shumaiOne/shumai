/**
* | output |
* | --- |
* | "Failed to remove member" |
*
* @param {Failed_To_Remove_MemberInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_remove_member: ((inputs?: Failed_To_Remove_MemberInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_Remove_MemberInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_Remove_MemberInputs = {};
