/**
* | output |
* | --- |
* | "Context ({count})" |
*
* @param {Chat_ContextInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const chat_context: ((inputs: Chat_ContextInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Chat_ContextInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Chat_ContextInputs = {
    count: NonNullable<unknown>;
};
