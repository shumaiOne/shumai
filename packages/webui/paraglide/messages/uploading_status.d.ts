/**
* | output |
* | --- |
* | "Uploading" |
*
* @param {Uploading_StatusInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const uploading_status: ((inputs?: Uploading_StatusInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Uploading_StatusInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Uploading_StatusInputs = {};
