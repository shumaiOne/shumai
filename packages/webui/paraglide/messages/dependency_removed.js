/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dependency_RemovedInputs */

const en_dependency_removed = /** @type {(inputs: Dependency_RemovedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Dependency removed`)
};

const zh_dependency_removed = /** @type {(inputs: Dependency_RemovedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`依赖已移除`)
};

/**
* | output |
* | --- |
* | "Dependency removed" |
*
* @param {Dependency_RemovedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const dependency_removed = /** @type {((inputs?: Dependency_RemovedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dependency_RemovedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_dependency_removed(inputs)
	return zh_dependency_removed(inputs)
});