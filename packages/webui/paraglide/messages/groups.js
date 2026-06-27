/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} GroupsInputs */

const en_groups = /** @type {(inputs: GroupsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Groups`)
};

const zh_groups = /** @type {(inputs: GroupsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`分组`)
};

/**
* | output |
* | --- |
* | "Groups" |
*
* @param {GroupsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const groups = /** @type {((inputs?: GroupsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<GroupsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_groups(inputs)
	return zh_groups(inputs)
});