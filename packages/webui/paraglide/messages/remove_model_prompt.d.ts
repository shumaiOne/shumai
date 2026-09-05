/**
* | output |
* | --- |
* | "Remove model {modelId} ({provider}) from enabled models?" |
*
* @param {Remove_Model_PromptInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const remove_model_prompt: ((inputs: Remove_Model_PromptInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Remove_Model_PromptInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Remove_Model_PromptInputs = {
    modelId: NonNullable<unknown>;
    provider: NonNullable<unknown>;
};
