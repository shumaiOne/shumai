/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_DependenciesInputs */

const en_no_dependencies = /** @type {(inputs: No_DependenciesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No dependencies`)
};

const zh_no_dependencies = /** @type {(inputs: No_DependenciesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`无依赖关系`)
};

/**
* | output |
* | --- |
* | "No dependencies" |
*
* @param {No_DependenciesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_dependencies = /** @type {((inputs?: No_DependenciesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_DependenciesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_dependencies(inputs)
	return zh_no_dependencies(inputs)
});