/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_Name_PlaceholderInputs */

const en_project_name_placeholder = /** @type {(inputs: Project_Name_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`e.g. Acme Marketing, Q3 Product Launch...`)
};

const zh_project_name_placeholder = /** @type {(inputs: Project_Name_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`例如：品牌营销、第三季度产品发布...`)
};

/**
* | output |
* | --- |
* | "e.g. Acme Marketing, Q3 Product Launch..." |
*
* @param {Project_Name_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_name_placeholder = /** @type {((inputs?: Project_Name_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_Name_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_project_name_placeholder(inputs)
	return zh_project_name_placeholder(inputs)
});