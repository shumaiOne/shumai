/**
* | output |
* | --- |
* | "Only project owners can edit AGENTS.md instructions." |
*
* @param {Agents_Md_Readonly_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agents_md_readonly_hint: ((inputs?: Agents_Md_Readonly_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agents_Md_Readonly_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agents_Md_Readonly_HintInputs = {};
