/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Network_Domain_Pattern_PlaceholderInputs */

const en_network_domain_pattern_placeholder = /** @type {(inputs: Network_Domain_Pattern_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`e.g. * or *.openai.com`)
};

const zh_network_domain_pattern_placeholder = /** @type {(inputs: Network_Domain_Pattern_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`例如 * 或 *.openai.com`)
};

/**
* | output |
* | --- |
* | "e.g. * or *.openai.com" |
*
* @param {Network_Domain_Pattern_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const network_domain_pattern_placeholder = /** @type {((inputs?: Network_Domain_Pattern_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Network_Domain_Pattern_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_network_domain_pattern_placeholder(inputs)
	return zh_network_domain_pattern_placeholder(inputs)
});