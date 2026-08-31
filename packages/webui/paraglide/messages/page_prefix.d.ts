/**
* | output |
* | --- |
* | "Page {page}" |
*
* @param {Page_PrefixInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const page_prefix: ((inputs: Page_PrefixInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Page_PrefixInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Page_PrefixInputs = {
    page: NonNullable<unknown>;
};
