/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ envKey: NonNullable<unknown> }} Api_Key_Or_Env_Var_PlaceholderInputs */

const en_api_key_or_env_var_placeholder = /** @type {(inputs: Api_Key_Or_Env_Var_PlaceholderInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Leave empty to use default env var (${i?.envKey})`)
};

const zh_api_key_or_env_var_placeholder = /** @type {(inputs: Api_Key_Or_Env_Var_PlaceholderInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`留空以使用默认环境变量 (${i?.envKey})`)
};

/**
* | output |
* | --- |
* | "Leave empty to use default env var ({envKey})" |
*
* @param {Api_Key_Or_Env_Var_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_key_or_env_var_placeholder = /** @type {((inputs: Api_Key_Or_Env_Var_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Api_Key_Or_Env_Var_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_api_key_or_env_var_placeholder(inputs)
	return zh_api_key_or_env_var_placeholder(inputs)
});