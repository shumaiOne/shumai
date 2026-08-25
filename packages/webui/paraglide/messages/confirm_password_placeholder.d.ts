/**
* | output |
* | --- |
* | "Confirm new password" |
*
* @param {Confirm_Password_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const confirm_password_placeholder: ((inputs?: Confirm_Password_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Confirm_Password_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Confirm_Password_PlaceholderInputs = {};
