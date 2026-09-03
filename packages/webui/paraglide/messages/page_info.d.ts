/**
* | output |
* | --- |
* | "Page {current} of {total}" |
*
* @param {Page_InfoInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const page_info: ((inputs: Page_InfoInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Page_InfoInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Page_InfoInputs = {
    current: NonNullable<unknown>;
    total: NonNullable<unknown>;
};
