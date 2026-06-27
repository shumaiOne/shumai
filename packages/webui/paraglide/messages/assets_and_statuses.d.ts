/**
* | output |
* | --- |
* | "Assets & Statuses" |
*
* @param {Assets_And_StatusesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const assets_and_statuses: ((inputs?: Assets_And_StatusesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Assets_And_StatusesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Assets_And_StatusesInputs = {};
