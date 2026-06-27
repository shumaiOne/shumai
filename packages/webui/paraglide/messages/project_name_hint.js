/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_Name_HintInputs */

const en_project_name_hint = /** @type {(inputs: Project_Name_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A clear, concise name to identify your project space.`)
};

const zh_project_name_hint = /** @type {(inputs: Project_Name_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`简洁明了的名称，用于标识您的项目空间。`)
};

/**
* | output |
* | --- |
* | "A clear, concise name to identify your project space." |
*
* @param {Project_Name_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_name_hint = /** @type {((inputs?: Project_Name_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_Name_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_project_name_hint(inputs)
	return zh_project_name_hint(inputs)
});