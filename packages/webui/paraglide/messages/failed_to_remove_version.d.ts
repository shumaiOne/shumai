/**
* | output |
* | --- |
* | "Failed to remove version" |
*
* @param {Failed_To_Remove_VersionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_remove_version: ((inputs?: Failed_To_Remove_VersionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_Remove_VersionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_Remove_VersionInputs = {};
