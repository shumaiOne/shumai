/**
* | output |
* | --- |
* | "Strategy: We select the best resolution from your list that supports the input quality. Content is never upscaled." |
*
* @param {Transcode_Strategy_NoteInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const transcode_strategy_note: ((inputs?: Transcode_Strategy_NoteInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Transcode_Strategy_NoteInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Transcode_Strategy_NoteInputs = {};
