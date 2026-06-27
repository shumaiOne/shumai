/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Custom_Domains_AllowedInputs */

const en_no_custom_domains_allowed = /** @type {(inputs: No_Custom_Domains_AllowedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No custom domains allowed`)
};

const zh_no_custom_domains_allowed = /** @type {(inputs: No_Custom_Domains_AllowedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`没有自定义允许域名`)
};

/**
* | output |
* | --- |
* | "No custom domains allowed" |
*
* @param {No_Custom_Domains_AllowedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_custom_domains_allowed = /** @type {((inputs?: No_Custom_Domains_AllowedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Custom_Domains_AllowedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_custom_domains_allowed(inputs)
	return zh_no_custom_domains_allowed(inputs)
});