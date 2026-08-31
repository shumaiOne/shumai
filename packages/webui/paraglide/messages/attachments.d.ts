/**
* | output |
* | --- |
* | "Attachments" |
*
* @param {AttachmentsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const attachments: ((inputs?: AttachmentsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<AttachmentsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type AttachmentsInputs = {};
