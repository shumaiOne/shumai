/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_DependencyInputs */

const en_add_dependency = /** @type {(inputs: Add_DependencyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add Dependency`)
};

const zh_add_dependency = /** @type {(inputs: Add_DependencyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加依赖`)
};

/**
* | output |
* | --- |
* | "Add Dependency" |
*
* @param {Add_DependencyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_dependency = /** @type {((inputs?: Add_DependencyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_DependencyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_dependency(inputs)
	return zh_add_dependency(inputs)
});