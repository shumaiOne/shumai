/**
* | output |
* | --- |
* | "This action cannot be undone. This will permanently delete the provider \"{name}\" and all associated model configurations." |
*
* @param {Delete_Provider_ConfirmationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_provider_confirmation: ((inputs: Delete_Provider_ConfirmationInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Delete_Provider_ConfirmationInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Delete_Provider_ConfirmationInputs = {
    name: NonNullable<unknown>;
};
