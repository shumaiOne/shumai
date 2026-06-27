/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Unknown_ProjectInputs */

const en_unknown_project = /** @type {(inputs: Unknown_ProjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`unknown project`)
};

const zh_unknown_project = /** @type {(inputs: Unknown_ProjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未知项目`)
};

/**
* | output |
* | --- |
* | "unknown project" |
*
* @param {Unknown_ProjectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unknown_project = /** @type {((inputs?: Unknown_ProjectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unknown_ProjectInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_unknown_project(inputs)
	return zh_unknown_project(inputs)
});