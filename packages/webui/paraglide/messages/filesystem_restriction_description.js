/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Filesystem_Restriction_DescriptionInputs */

const en_filesystem_restriction_description = /** @type {(inputs: Filesystem_Restriction_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The agent is restricted to reading and writing only within the .pi and /tmp folders. These settings are currently hardcoded for security.`)
};

const zh_filesystem_restriction_description = /** @type {(inputs: Filesystem_Restriction_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`智能体仅限于在 .pi 和 /tmp 文件夹内读写。这些设置目前出于安全考虑已硬编码。`)
};

/**
* | output |
* | --- |
* | "The agent is restricted to reading and writing only within the .pi and /tmp folders. These settings are currently hardcoded for security." |
*
* @param {Filesystem_Restriction_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const filesystem_restriction_description = /** @type {((inputs?: Filesystem_Restriction_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Filesystem_Restriction_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_filesystem_restriction_description(inputs)
	return zh_filesystem_restriction_description(inputs)
});