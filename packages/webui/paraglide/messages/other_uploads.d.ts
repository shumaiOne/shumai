/**
* | output |
* | --- |
* | "Other Uploads" |
*
* @param {Other_UploadsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const other_uploads: ((inputs?: Other_UploadsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Other_UploadsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Other_UploadsInputs = {};
