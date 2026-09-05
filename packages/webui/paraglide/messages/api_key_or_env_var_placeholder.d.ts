/**
* | output |
* | --- |
* | "Leave empty to use default env var ({envKey})" |
*
* @param {Api_Key_Or_Env_Var_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_key_or_env_var_placeholder: ((inputs: Api_Key_Or_Env_Var_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Api_Key_Or_Env_Var_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Api_Key_Or_Env_Var_PlaceholderInputs = {
    envKey: NonNullable<unknown>;
};
