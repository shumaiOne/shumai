/**
* | output |
* | --- |
* | "Open a supported file to add markup" |
*
* @param {Open_File_To_Add_MarkupInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const open_file_to_add_markup: ((inputs?: Open_File_To_Add_MarkupInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Open_File_To_Add_MarkupInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Open_File_To_Add_MarkupInputs = {};
