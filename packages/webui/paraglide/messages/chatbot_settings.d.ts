/**
* | output |
* | --- |
* | "Chatbot Settings" |
*
* @param {Chatbot_SettingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chatbot_settings: ((inputs?: Chatbot_SettingsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Chatbot_SettingsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Chatbot_SettingsInputs = {};
