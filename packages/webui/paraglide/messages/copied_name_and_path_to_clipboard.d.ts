/**
* | output |
* | --- |
* | "Copied name and path to clipboard" |
*
* @param {Copied_Name_And_Path_To_ClipboardInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const copied_name_and_path_to_clipboard: ((inputs?: Copied_Name_And_Path_To_ClipboardInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Copied_Name_And_Path_To_ClipboardInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Copied_Name_And_Path_To_ClipboardInputs = {};
