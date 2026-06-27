/**
* | output |
* | --- |
* | "{count} Folders" |
*
* @param {N_Folders_PluralInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_folders_plural: ((inputs: N_Folders_PluralInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Folders_PluralInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Folders_PluralInputs = {
    count: NonNullable<unknown>;
};
