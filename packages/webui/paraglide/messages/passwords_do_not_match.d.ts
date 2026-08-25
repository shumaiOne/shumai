/**
* | output |
* | --- |
* | "Passwords do not match" |
*
* @param {Passwords_Do_Not_MatchInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const passwords_do_not_match: ((inputs?: Passwords_Do_Not_MatchInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Passwords_Do_Not_MatchInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Passwords_Do_Not_MatchInputs = {};
