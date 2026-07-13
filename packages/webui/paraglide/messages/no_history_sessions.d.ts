/**
* | output |
* | --- |
* | "No chat history found." |
*
* @param {No_History_SessionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_history_sessions: ((inputs?: No_History_SessionsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_History_SessionsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_History_SessionsInputs = {};
