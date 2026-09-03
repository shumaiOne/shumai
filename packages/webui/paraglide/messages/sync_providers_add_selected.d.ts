/**
* | output |
* | --- |
* | "Add Selected ({count})" |
*
* @param {Sync_Providers_Add_SelectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_add_selected: ((inputs: Sync_Providers_Add_SelectedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sync_Providers_Add_SelectedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sync_Providers_Add_SelectedInputs = {
    count: NonNullable<unknown>;
};
