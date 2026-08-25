/**
* | output |
* | --- |
* | "No recently viewed files" |
*
* @param {No_Recent_FilesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_recent_files: ((inputs?: No_Recent_FilesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Recent_FilesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Recent_FilesInputs = {};
