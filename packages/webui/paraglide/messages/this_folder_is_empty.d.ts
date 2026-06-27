/**
* | output |
* | --- |
* | "This folder is empty" |
*
* @param {This_Folder_Is_EmptyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const this_folder_is_empty: ((inputs?: This_Folder_Is_EmptyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<This_Folder_Is_EmptyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type This_Folder_Is_EmptyInputs = {};
