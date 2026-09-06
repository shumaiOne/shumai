/**
* | output |
* | --- |
* | "API Key or Environment Variable" |
*
* @param {Api_Key_Or_Env_VarInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_key_or_env_var: ((inputs?: Api_Key_Or_Env_VarInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Api_Key_Or_Env_VarInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Api_Key_Or_Env_VarInputs = {};
