/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} All_ProjectsInputs */

const en_all_projects = /** @type {(inputs: All_ProjectsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`All Projects`)
};

const zh_all_projects = /** @type {(inputs: All_ProjectsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`所有项目`)
};

/**
* | output |
* | --- |
* | "All Projects" |
*
* @param {All_ProjectsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_projects = /** @type {((inputs?: All_ProjectsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<All_ProjectsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_all_projects(inputs)
	return zh_all_projects(inputs)
});