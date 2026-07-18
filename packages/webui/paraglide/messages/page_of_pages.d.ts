/**
* | output |
* | --- |
* | "Page {current} of {total}" |
*
* @param {Page_Of_PagesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const page_of_pages: ((inputs: Page_Of_PagesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Page_Of_PagesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Page_Of_PagesInputs = {
    current: NonNullable<unknown>;
    total: NonNullable<unknown>;
};
