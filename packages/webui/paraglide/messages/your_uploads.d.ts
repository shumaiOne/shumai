/**
* | output |
* | --- |
* | "Your Uploads" |
*
* @param {Your_UploadsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const your_uploads: ((inputs?: Your_UploadsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Your_UploadsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Your_UploadsInputs = {};
