/**
* | output |
* | --- |
* | "Transcode Settings" |
*
* @param {Transcode_SettingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const transcode_settings: ((inputs?: Transcode_SettingsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Transcode_SettingsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Transcode_SettingsInputs = {};
