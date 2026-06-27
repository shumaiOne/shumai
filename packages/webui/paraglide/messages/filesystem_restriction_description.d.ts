/**
* | output |
* | --- |
* | "The agent is restricted to reading and writing only within the .pi and /tmp folders. These settings are currently hardcoded for security." |
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
