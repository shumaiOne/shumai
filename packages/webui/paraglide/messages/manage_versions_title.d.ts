/**
* | output |
* | --- |
* | "Manage versions" |
*
* @param {Manage_Versions_TitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const manage_versions_title: ((inputs?: Manage_Versions_TitleInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Manage_Versions_TitleInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Manage_Versions_TitleInputs = {};
