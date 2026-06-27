/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Avatar_UpdatedInputs */

const en_avatar_updated = /** @type {(inputs: Avatar_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Avatar updated successfully`)
};

const zh_avatar_updated = /** @type {(inputs: Avatar_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`头像更新成功`)
};

/**
* | output |
* | --- |
* | "Avatar updated successfully" |
*
* @param {Avatar_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const avatar_updated = /** @type {((inputs?: Avatar_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Avatar_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_avatar_updated(inputs)
	return zh_avatar_updated(inputs)
});