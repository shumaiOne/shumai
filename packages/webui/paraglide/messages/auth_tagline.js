/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_TaglineInputs */

const en_auth_tagline = /** @type {(inputs: Auth_TaglineInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`One workspace for all your creative assets.`)
};

const zh_auth_tagline = /** @type {(inputs: Auth_TaglineInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`一站式创意资产管理协作平台。`)
};

/**
* | output |
* | --- |
* | "One workspace for all your creative assets." |
*
* @param {Auth_TaglineInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const auth_tagline = /** @type {((inputs?: Auth_TaglineInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_TaglineInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_auth_tagline(inputs)
	return zh_auth_tagline(inputs)
});