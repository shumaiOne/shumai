/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_DomainInputs */

const en_add_domain = /** @type {(inputs: Add_DomainInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add Domain`)
};

const zh_add_domain = /** @type {(inputs: Add_DomainInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加域名`)
};

/**
* | output |
* | --- |
* | "Add Domain" |
*
* @param {Add_DomainInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_domain = /** @type {((inputs?: Add_DomainInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_DomainInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_domain(inputs)
	return zh_add_domain(inputs)
});