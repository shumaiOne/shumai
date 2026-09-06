/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ envKey: NonNullable<unknown> }} Default_Env_Var_DescInputs */

const en_default_env_var_desc = /** @type {(inputs: Default_Env_Var_DescInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Default: ${i?.envKey}`)
};

const zh_default_env_var_desc = /** @type {(inputs: Default_Env_Var_DescInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`默认：${i?.envKey}`)
};

/**
* | output |
* | --- |
* | "Default: {envKey}" |
*
* @param {Default_Env_Var_DescInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const default_env_var_desc = /** @type {((inputs: Default_Env_Var_DescInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Default_Env_Var_DescInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_default_env_var_desc(inputs)
	return zh_default_env_var_desc(inputs)
});