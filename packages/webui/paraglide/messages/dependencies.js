/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} DependenciesInputs */

const en_dependencies = /** @type {(inputs: DependenciesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Dependencies`)
};

const zh_dependencies = /** @type {(inputs: DependenciesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`依赖关系`)
};

/**
* | output |
* | --- |
* | "Dependencies" |
*
* @param {DependenciesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const dependencies = /** @type {((inputs?: DependenciesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<DependenciesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_dependencies(inputs)
	return zh_dependencies(inputs)
});