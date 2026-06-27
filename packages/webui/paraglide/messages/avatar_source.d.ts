/**
* | output |
* | --- |
* | "Avatar Source" |
*
* @param {Avatar_SourceInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const avatar_source: ((inputs?: Avatar_SourceInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Avatar_SourceInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Avatar_SourceInputs = {};
