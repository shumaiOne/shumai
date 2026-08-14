/**
* | output |
* | --- |
* | "Loading AGENTS.md..." |
*
* @param {Agents_Md_LoadingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agents_md_loading: ((inputs?: Agents_Md_LoadingInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Agents_Md_LoadingInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Agents_Md_LoadingInputs = {};
