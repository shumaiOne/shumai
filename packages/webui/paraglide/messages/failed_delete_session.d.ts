/**
* | output |
* | --- |
* | "Failed to delete session" |
*
* @param {Failed_Delete_SessionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_delete_session: ((inputs?: Failed_Delete_SessionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Delete_SessionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Delete_SessionInputs = {};
