/**
* | output |
* | --- |
* | "Incorrect password. Please try again." |
*
* @param {Incorrect_PasswordInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const incorrect_password: ((inputs?: Incorrect_PasswordInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Incorrect_PasswordInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Incorrect_PasswordInputs = {};
