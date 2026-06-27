/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Manage_Project_DescriptionInputs */

const en_manage_project_description = /** @type {(inputs: Manage_Project_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Manage and update your project workspace configurations.`)
};

const zh_manage_project_description = /** @type {(inputs: Manage_Project_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`管理和更新您的项目工作区配置。`)
};

/**
* | output |
* | --- |
* | "Manage and update your project workspace configurations." |
*
* @param {Manage_Project_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const manage_project_description = /** @type {((inputs?: Manage_Project_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Manage_Project_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_manage_project_description(inputs)
	return zh_manage_project_description(inputs)
});