/**
* | output |
* | --- |
* | "Give AI agents instructions and context for this project or folder. Shumai automatically loads this file, along with AGENTS.md files from parent folders up t..." |
*
* @param {Agents_Md_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agents_md_placeholder: ((inputs?: Agents_Md_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agents_Md_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agents_Md_PlaceholderInputs = {};
