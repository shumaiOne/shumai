/**
* | output |
* | --- |
* | "Registration Disabled" |
*
* @param {Registration_DisabledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const registration_disabled: ((inputs?: Registration_DisabledInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Registration_DisabledInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Registration_DisabledInputs = {};
