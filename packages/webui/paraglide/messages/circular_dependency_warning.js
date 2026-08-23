/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Circular_Dependency_WarningInputs */

const en_circular_dependency_warning = /** @type {(inputs: Circular_Dependency_WarningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Cannot select this task as it would create a circular dependency`)
};

const zh_circular_dependency_warning = /** @type {(inputs: Circular_Dependency_WarningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`无法选择此任务，因为这会产生循环依赖`)
};

/**
* | output |
* | --- |
* | "Cannot select this task as it would create a circular dependency" |
*
* @param {Circular_Dependency_WarningInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const circular_dependency_warning = /** @type {((inputs?: Circular_Dependency_WarningInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Circular_Dependency_WarningInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_circular_dependency_warning(inputs)
	return zh_circular_dependency_warning(inputs)
});