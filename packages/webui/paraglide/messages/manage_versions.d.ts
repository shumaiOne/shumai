/**
* | output |
* | --- |
* | "Manage versions" |
*
* @param {Manage_VersionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const manage_versions: ((inputs?: Manage_VersionsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Manage_VersionsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Manage_VersionsInputs = {};
