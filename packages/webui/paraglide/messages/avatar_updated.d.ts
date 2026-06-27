/**
* | output |
* | --- |
* | "Avatar updated successfully" |
*
* @param {Avatar_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const avatar_updated: ((inputs?: Avatar_UpdatedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Avatar_UpdatedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Avatar_UpdatedInputs = {};
