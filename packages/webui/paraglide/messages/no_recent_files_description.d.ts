/**
* | output |
* | --- |
* | "Files you view in this project will appear here." |
*
* @param {No_Recent_Files_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_recent_files_description: ((inputs?: No_Recent_Files_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Recent_Files_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Recent_Files_DescriptionInputs = {};
