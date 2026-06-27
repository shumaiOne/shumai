/**
* | output |
* | --- |
* | "Select a file to view its details and comments." |
*
* @param {Select_File_To_View_DetailsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_file_to_view_details: ((inputs?: Select_File_To_View_DetailsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_File_To_View_DetailsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_File_To_View_DetailsInputs = {};
