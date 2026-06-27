/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_CreatedInputs */

const en_project_created = /** @type {(inputs: Project_CreatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Project created`)
};

const zh_project_created = /** @type {(inputs: Project_CreatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`项目已创建`)
};

/**
* | output |
* | --- |
* | "Project created" |
*
* @param {Project_CreatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_created = /** @type {((inputs?: Project_CreatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_CreatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_project_created(inputs)
	return zh_project_created(inputs)
});