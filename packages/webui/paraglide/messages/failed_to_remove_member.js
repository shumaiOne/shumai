/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Remove_MemberInputs */

const en_failed_to_remove_member = /** @type {(inputs: Failed_To_Remove_MemberInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to remove member`)
};

const zh_failed_to_remove_member = /** @type {(inputs: Failed_To_Remove_MemberInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`移除成员失败`)
};

/**
* | output |
* | --- |
* | "Failed to remove member" |
*
* @param {Failed_To_Remove_MemberInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_remove_member = /** @type {((inputs?: Failed_To_Remove_MemberInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Remove_MemberInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_remove_member(inputs)
	return zh_failed_to_remove_member(inputs)
});