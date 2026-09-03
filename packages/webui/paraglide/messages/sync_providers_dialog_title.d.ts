/**
* | output |
* | --- |
* | "Sync Providers & Models" |
*
* @param {Sync_Providers_Dialog_TitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_dialog_title: ((inputs?: Sync_Providers_Dialog_TitleInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_Providers_Dialog_TitleInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_Providers_Dialog_TitleInputs = {};
