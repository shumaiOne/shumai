/**
* | output |
* | --- |
* | "Selected files and folders will be prepared for download." |
*
* @param {Selected_Files_Will_Be_PreparedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const selected_files_will_be_prepared: ((inputs?: Selected_Files_Will_Be_PreparedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Selected_Files_Will_Be_PreparedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Selected_Files_Will_Be_PreparedInputs = {};
