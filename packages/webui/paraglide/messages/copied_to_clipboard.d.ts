/**
* | output |
* | --- |
* | "Copied to clipboard" |
*
* @param {Copied_To_ClipboardInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const copied_to_clipboard: ((inputs?: Copied_To_ClipboardInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Copied_To_ClipboardInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Copied_To_ClipboardInputs = {};
