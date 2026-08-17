/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_MembersInputs */

const en_select_members = /** @type {(inputs: Select_MembersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Members`)
};

const zh_select_members = /** @type {(inputs: Select_MembersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择成员`)
};

/**
* | output |
* | --- |
* | "Select Members" |
*
* @param {Select_MembersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_members = /** @type {((inputs?: Select_MembersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_MembersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_members(inputs)
	return zh_select_members(inputs)
});