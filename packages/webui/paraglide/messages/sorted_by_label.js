/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sorted_By_LabelInputs */

const en_sorted_by_label = /** @type {(inputs: Sorted_By_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sorted by`)
};

const zh_sorted_by_label = /** @type {(inputs: Sorted_By_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`排序方式`)
};

/**
* | output |
* | --- |
* | "Sorted by" |
*
* @param {Sorted_By_LabelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sorted_by_label = /** @type {((inputs?: Sorted_By_LabelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sorted_By_LabelInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sorted_by_label(inputs)
	return zh_sorted_by_label(inputs)
});