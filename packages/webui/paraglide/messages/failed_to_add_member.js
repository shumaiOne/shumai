/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ name: NonNullable<unknown> }} Failed_To_Add_MemberInputs */

const en_failed_to_add_member = /** @type {(inputs: Failed_To_Add_MemberInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Failed to add ${i?.name}`)
};

const zh_failed_to_add_member = /** @type {(inputs: Failed_To_Add_MemberInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`添加 ${i?.name} 失败`)
};

/**
* | output |
* | --- |
* | "Failed to add {name}" |
*
* @param {Failed_To_Add_MemberInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_add_member = /** @type {((inputs: Failed_To_Add_MemberInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Add_MemberInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_add_member(inputs)
	return zh_failed_to_add_member(inputs)
});