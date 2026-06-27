/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Profile_UpdatedInputs */

const en_profile_updated = /** @type {(inputs: Profile_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Profile updated successfully`)
};

const zh_profile_updated = /** @type {(inputs: Profile_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`个人资料更新成功`)
};

/**
* | output |
* | --- |
* | "Profile updated successfully" |
*
* @param {Profile_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const profile_updated = /** @type {((inputs?: Profile_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Profile_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_profile_updated(inputs)
	return zh_profile_updated(inputs)
});