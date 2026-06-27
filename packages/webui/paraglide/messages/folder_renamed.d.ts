/**
* | output |
* | --- |
* | "Folder renamed" |
*
* @param {Folder_RenamedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const folder_renamed: ((inputs?: Folder_RenamedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Folder_RenamedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Folder_RenamedInputs = {};
