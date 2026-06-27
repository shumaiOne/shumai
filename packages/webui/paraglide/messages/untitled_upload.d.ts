/**
* | output |
* | --- |
* | "Untitled Upload" |
*
* @param {Untitled_UploadInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const untitled_upload: ((inputs?: Untitled_UploadInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Untitled_UploadInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Untitled_UploadInputs = {};
