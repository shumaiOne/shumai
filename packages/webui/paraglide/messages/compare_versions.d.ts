/**
* | output |
* | --- |
* | "Compare Versions" |
*
* @param {Compare_VersionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const compare_versions: ((inputs?: Compare_VersionsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Compare_VersionsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Compare_VersionsInputs = {};
