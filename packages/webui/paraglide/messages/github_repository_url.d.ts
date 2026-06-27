/**
* | output |
* | --- |
* | "GitHub Repository URL" |
*
* @param {Github_Repository_UrlInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const github_repository_url: ((inputs?: Github_Repository_UrlInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Github_Repository_UrlInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Github_Repository_UrlInputs = {};
