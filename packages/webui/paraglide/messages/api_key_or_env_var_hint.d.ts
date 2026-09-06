/**
* | output |
* | --- |
* | "Enter an API key or an environment variable name (e.g. {envKey}). Leave empty to restore default environment variable." |
*
* @param {Api_Key_Or_Env_Var_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_key_or_env_var_hint: ((inputs: Api_Key_Or_Env_Var_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Api_Key_Or_Env_Var_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Api_Key_Or_Env_Var_HintInputs = {
    envKey: NonNullable<unknown>;
};
