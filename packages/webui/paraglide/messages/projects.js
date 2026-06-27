/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ProjectsInputs */

const en_projects = /** @type {(inputs: ProjectsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Projects`)
};

const zh_projects = /** @type {(inputs: ProjectsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`项目`)
};

/**
* | output |
* | --- |
* | "Projects" |
*
* @param {ProjectsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const projects = /** @type {((inputs?: ProjectsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ProjectsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_projects(inputs)
	return zh_projects(inputs)
});