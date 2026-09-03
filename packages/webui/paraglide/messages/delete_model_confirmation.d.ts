/**
* | output |
* | --- |
* | "This action cannot be undone. This will permanently delete the model \"{name}\"." |
*
* @param {Delete_Model_ConfirmationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_model_confirmation: ((inputs: Delete_Model_ConfirmationInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Delete_Model_ConfirmationInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Delete_Model_ConfirmationInputs = {
    name: NonNullable<unknown>;
};
