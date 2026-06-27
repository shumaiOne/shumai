/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} New_LabelInputs */

const en_new_label = /** @type {(inputs: New_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`New`)
};

const zh_new_label = /** @type {(inputs: New_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`新建`)
};

/**
* | output |
* | --- |
* | "New" |
*
* @param {New_LabelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const new_label = /** @type {((inputs?: New_LabelInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<New_LabelInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_new_label(inputs)
	return zh_new_label(inputs)
});