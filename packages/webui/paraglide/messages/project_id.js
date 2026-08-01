/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_IdInputs */

const en_project_id = /** @type {(inputs: Project_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Project ID`)
};

const zh_project_id = /** @type {(inputs: Project_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`项目 ID`)
};

/**
* | output |
* | --- |
* | "Project ID" |
*
* @param {Project_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_id = /** @type {((inputs?: Project_IdInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_IdInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_project_id(inputs)
	return zh_project_id(inputs)
});