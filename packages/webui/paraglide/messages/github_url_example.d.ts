/**
* | output |
* | --- |
* | "Example: https://github.com/google/gemini-cli" |
*
* @param {Github_Url_ExampleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const github_url_example: ((inputs?: Github_Url_ExampleInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Github_Url_ExampleInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Github_Url_ExampleInputs = {};
