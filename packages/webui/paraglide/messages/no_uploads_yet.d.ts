/**
* | output |
* | --- |
* | "No uploads yet" |
*
* @param {No_Uploads_YetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_uploads_yet: ((inputs?: No_Uploads_YetInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Uploads_YetInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Uploads_YetInputs = {};
