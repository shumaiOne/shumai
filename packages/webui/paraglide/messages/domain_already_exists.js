/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Domain_Already_ExistsInputs */

const en_domain_already_exists = /** @type {(inputs: Domain_Already_ExistsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Domain already exists`)
};

const zh_domain_already_exists = /** @type {(inputs: Domain_Already_ExistsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`域名已存在`)
};

/**
* | output |
* | --- |
* | "Domain already exists" |
*
* @param {Domain_Already_ExistsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const domain_already_exists = /** @type {((inputs?: Domain_Already_ExistsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Domain_Already_ExistsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_domain_already_exists(inputs)
	return zh_domain_already_exists(inputs)
});