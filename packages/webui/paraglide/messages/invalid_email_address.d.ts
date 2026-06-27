/**
* | output |
* | --- |
* | "Invalid email address" |
*
* @param {Invalid_Email_AddressInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invalid_email_address: ((inputs?: Invalid_Email_AddressInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Invalid_Email_AddressInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Invalid_Email_AddressInputs = {};
