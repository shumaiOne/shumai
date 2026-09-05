/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ envKey: NonNullable<unknown> }} Api_Key_Or_Env_Var_HintInputs */

const en_api_key_or_env_var_hint = /** @type {(inputs: Api_Key_Or_Env_Var_HintInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Enter an API key or an environment variable name (e.g. ${i?.envKey}). Leave empty to restore default environment variable.`)
};

const zh_api_key_or_env_var_hint = /** @type {(inputs: Api_Key_Or_Env_Var_HintInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`输入 API 密钥或环境变量名（例如 ${i?.envKey}）。留空将恢复默认环境变量。`)
};

/**
* | output |
* | --- |
* | "Enter an API key or an environment variable name (e.g. {envKey}). Leave empty to restore default environment variable." |
*
* @param {Api_Key_Or_Env_Var_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_key_or_env_var_hint = /** @type {((inputs: Api_Key_Or_Env_Var_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Api_Key_Or_Env_Var_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_api_key_or_env_var_hint(inputs)
	return zh_api_key_or_env_var_hint(inputs)
});