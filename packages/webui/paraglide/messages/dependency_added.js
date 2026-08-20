/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dependency_AddedInputs */

const en_dependency_added = /** @type {(inputs: Dependency_AddedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Dependency added`)
};

const zh_dependency_added = /** @type {(inputs: Dependency_AddedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`依赖已添加`)
};

/**
* | output |
* | --- |
* | "Dependency added" |
*
* @param {Dependency_AddedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const dependency_added = /** @type {((inputs?: Dependency_AddedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dependency_AddedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_dependency_added(inputs)
	return zh_dependency_added(inputs)
});