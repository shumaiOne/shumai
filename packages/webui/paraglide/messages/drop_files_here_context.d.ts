/**
* | output |
* | --- |
* | "Drop files or folders here as context" |
*
* @param {Drop_Files_Here_ContextInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const drop_files_here_context: ((inputs?: Drop_Files_Here_ContextInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Drop_Files_Here_ContextInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Drop_Files_Here_ContextInputs = {};
