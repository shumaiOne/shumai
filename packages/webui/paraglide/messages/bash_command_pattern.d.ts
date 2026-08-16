/**
* | output |
* | --- |
* | "Bash Match Wildcard" |
*
* @param {Bash_Command_PatternInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const bash_command_pattern: ((inputs?: Bash_Command_PatternInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Bash_Command_PatternInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Bash_Command_PatternInputs = {};
