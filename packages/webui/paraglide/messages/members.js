/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} MembersInputs */

const en_members = /** @type {(inputs: MembersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Members`)
};

const zh_members = /** @type {(inputs: MembersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`成员`)
};

/**
* | output |
* | --- |
* | "Members" |
*
* @param {MembersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const members = /** @type {((inputs?: MembersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<MembersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_members(inputs)
	return zh_members(inputs)
});