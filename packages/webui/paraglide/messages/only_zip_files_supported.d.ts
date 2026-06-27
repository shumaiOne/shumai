/**
* | output |
* | --- |
* | "Only .zip files are supported." |
*
* @param {Only_Zip_Files_SupportedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const only_zip_files_supported: ((inputs?: Only_Zip_Files_SupportedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Only_Zip_Files_SupportedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Only_Zip_Files_SupportedInputs = {};
