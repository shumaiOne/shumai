/**
* | output |
* | --- |
* | "Default: {envKey}" |
*
* @param {Default_Env_Var_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const default_env_var_desc: ((inputs: Default_Env_Var_DescInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Default_Env_Var_DescInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Default_Env_Var_DescInputs = {
    envKey: NonNullable<unknown>;
};
