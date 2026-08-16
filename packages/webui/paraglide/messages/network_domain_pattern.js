/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Network_Domain_PatternInputs */

const en_network_domain_pattern = /** @type {(inputs: Network_Domain_PatternInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Domain Wildcard`)
};

const zh_network_domain_pattern = /** @type {(inputs: Network_Domain_PatternInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`域名通配符`)
};

/**
* | output |
* | --- |
* | "Domain Wildcard" |
*
* @param {Network_Domain_PatternInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const network_domain_pattern = /** @type {((inputs?: Network_Domain_PatternInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Network_Domain_PatternInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_network_domain_pattern(inputs)
	return zh_network_domain_pattern(inputs)
});