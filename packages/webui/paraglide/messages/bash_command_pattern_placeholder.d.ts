/**
* | output |
* | --- |
* | "e.g. * or npm*" |
*
* @param {Bash_Command_Pattern_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const bash_command_pattern_placeholder: ((inputs?: Bash_Command_Pattern_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Bash_Command_Pattern_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Bash_Command_Pattern_PlaceholderInputs = {};
