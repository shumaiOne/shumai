/**
* | output |
* | --- |
* | "reply to: {message}" |
*
* @param {Reply_To_MessageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const reply_to_message: ((inputs: Reply_To_MessageInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Reply_To_MessageInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Reply_To_MessageInputs = {
    message: NonNullable<unknown>;
};
