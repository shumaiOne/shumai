/**
* | output |
* | --- |
* | "Personal Settings" |
*
* @param {Personal_SettingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const personal_settings: ((inputs?: Personal_SettingsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Personal_SettingsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Personal_SettingsInputs = {};
