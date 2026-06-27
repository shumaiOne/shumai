/**
* | output |
* | --- |
* | "Preparing Download" |
*
* @param {Preparing_DownloadInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const preparing_download: ((inputs?: Preparing_DownloadInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Preparing_DownloadInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Preparing_DownloadInputs = {};
