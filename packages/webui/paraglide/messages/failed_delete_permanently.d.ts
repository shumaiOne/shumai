/**
* | output |
* | --- |
* | "Failed to delete permanently" |
*
* @param {Failed_Delete_PermanentlyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_delete_permanently: ((inputs?: Failed_Delete_PermanentlyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Delete_PermanentlyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Delete_PermanentlyInputs = {};
