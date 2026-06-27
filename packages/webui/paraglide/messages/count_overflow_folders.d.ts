/**
* | output |
* | --- |
* | "10000+ Folders" |
*
* @param {Count_Overflow_FoldersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const count_overflow_folders: ((inputs?: Count_Overflow_FoldersInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Count_Overflow_FoldersInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Count_Overflow_FoldersInputs = {};
