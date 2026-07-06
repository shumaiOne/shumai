/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ProjectInputs */

const en_project = /** @type {(inputs: ProjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`project`)
};

const zh_project = /** @type {(inputs: ProjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`项目`)
};

/**
* | output |
* | --- |
* | "project" |
*
* @param {ProjectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project = /** @type {((inputs?: ProjectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ProjectInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_project(inputs)
	return zh_project(inputs)
});