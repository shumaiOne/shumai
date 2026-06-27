/**
* | output |
* | --- |
* | "Failed to fetch files" |
*
* @param {Failed_Fetch_FilesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_fetch_files: ((inputs?: Failed_Fetch_FilesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Fetch_FilesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Fetch_FilesInputs = {};
