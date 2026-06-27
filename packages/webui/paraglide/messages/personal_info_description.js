/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Personal_Info_DescriptionInputs */

const en_personal_info_description = /** @type {(inputs: Personal_Info_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Manage your profile name and avatar image.`)
};

const zh_personal_info_description = /** @type {(inputs: Personal_Info_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`管理您的个人资料名称和头像图片。`)
};

/**
* | output |
* | --- |
* | "Manage your profile name and avatar image." |
*
* @param {Personal_Info_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const personal_info_description = /** @type {((inputs?: Personal_Info_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Personal_Info_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_personal_info_description(inputs)
	return zh_personal_info_description(inputs)
});