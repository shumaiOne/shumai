/**
* | output |
* | --- |
* | "Allow download" |
*
* @param {Allow_DownloadInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const allow_download: ((inputs?: Allow_DownloadInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Allow_DownloadInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Allow_DownloadInputs = {};
