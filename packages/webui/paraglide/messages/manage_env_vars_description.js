/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Manage_Env_Vars_DescriptionInputs */

const en_manage_env_vars_description = /** @type {(inputs: Manage_Env_Vars_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Manage environment variables for this skill instance.`)
};

const zh_manage_env_vars_description = /** @type {(inputs: Manage_Env_Vars_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`管理此技能实例的环境变量。`)
};

/**
* | output |
* | --- |
* | "Manage environment variables for this skill instance." |
*
* @param {Manage_Env_Vars_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const manage_env_vars_description = /** @type {((inputs?: Manage_Env_Vars_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Manage_Env_Vars_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_manage_env_vars_description(inputs)
	return zh_manage_env_vars_description(inputs)
});