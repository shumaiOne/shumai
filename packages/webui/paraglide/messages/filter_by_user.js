/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Filter_By_UserInputs */

const en_filter_by_user = /** @type {(inputs: Filter_By_UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Filter by User`)
};

const zh_filter_by_user = /** @type {(inputs: Filter_By_UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`按用户筛选`)
};

/**
* | output |
* | --- |
* | "Filter by User" |
*
* @param {Filter_By_UserInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const filter_by_user = /** @type {((inputs?: Filter_By_UserInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Filter_By_UserInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_filter_by_user(inputs)
	return zh_filter_by_user(inputs)
});