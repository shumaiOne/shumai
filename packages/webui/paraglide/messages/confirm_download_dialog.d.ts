/**
* | output |
* | --- |
* | "Confirm Download" |
*
* @param {Confirm_Download_DialogInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const confirm_download_dialog: ((inputs?: Confirm_Download_DialogInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Confirm_Download_DialogInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Confirm_Download_DialogInputs = {};
