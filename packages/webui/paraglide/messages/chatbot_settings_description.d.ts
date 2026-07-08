/**
* | output |
* | --- |
* | "Choose which AI agent you want to chat with." |
*
* @param {Chatbot_Settings_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chatbot_settings_description: ((inputs?: Chatbot_Settings_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Chatbot_Settings_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Chatbot_Settings_DescriptionInputs = {};
