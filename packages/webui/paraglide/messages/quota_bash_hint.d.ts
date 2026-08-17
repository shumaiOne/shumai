/**
* | output |
* | --- |
* | "Supports wildcards (*). Examples: git *, npm test, curl *, python script.py (use * for all commands)" |
*
* @param {Quota_Bash_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_bash_hint: ((inputs?: Quota_Bash_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Bash_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Bash_HintInputs = {};
