/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Filter_By_ActionInputs */

const en_filter_by_action = /** @type {(inputs: Filter_By_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Filter by Action`)
};

const zh_filter_by_action = /** @type {(inputs: Filter_By_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`按操作筛选`)
};

/**
* | output |
* | --- |
* | "Filter by Action" |
*
* @param {Filter_By_ActionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const filter_by_action = /** @type {((inputs?: Filter_By_ActionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Filter_By_ActionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_filter_by_action(inputs)
	return zh_filter_by_action(inputs)
});