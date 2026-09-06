/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Api_Key_Or_Env_VarInputs */

const en_api_key_or_env_var = /** @type {(inputs: Api_Key_Or_Env_VarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`API Key or Environment Variable`)
};

const zh_api_key_or_env_var = /** @type {(inputs: Api_Key_Or_Env_VarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`API 密钥或环境变量名`)
};

/**
* | output |
* | --- |
* | "API Key or Environment Variable" |
*
* @param {Api_Key_Or_Env_VarInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const api_key_or_env_var = /** @type {((inputs?: Api_Key_Or_Env_VarInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Api_Key_Or_Env_VarInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_api_key_or_env_var(inputs)
	return zh_api_key_or_env_var(inputs)
});