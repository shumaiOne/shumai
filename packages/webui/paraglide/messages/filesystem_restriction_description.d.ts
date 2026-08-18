/**
* | output |
* | --- |
* | "Sandboxed shell commands can read workspace files except sensitive environment, certificate, and key files. They can write to the project's .pi folder and th..." |
*
* @param {Filesystem_Restriction_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const filesystem_restriction_description: ((inputs?: Filesystem_Restriction_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Filesystem_Restriction_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Filesystem_Restriction_DescriptionInputs = {};
