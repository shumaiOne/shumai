/**
* | output |
* | --- |
* | "Invalid credentials" |
*
* @param {Invalid_CredentialsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invalid_credentials: ((inputs?: Invalid_CredentialsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Invalid_CredentialsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Invalid_CredentialsInputs = {};
