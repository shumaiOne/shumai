/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_UpdatedInputs */

const en_project_updated = /** @type {(inputs: Project_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Project updated`)
};

const zh_project_updated = /** @type {(inputs: Project_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`项目已更新`)
};

/**
* | output |
* | --- |
* | "Project updated" |
*
* @param {Project_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_updated = /** @type {((inputs?: Project_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_project_updated(inputs)
	return zh_project_updated(inputs)
});