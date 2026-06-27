/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Auth_Community_CtaInputs */

const en_auth_community_cta = /** @type {(inputs: Auth_Community_CtaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Join our community of developers and designers.`)
};

const zh_auth_community_cta = /** @type {(inputs: Auth_Community_CtaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`加入我们的开发者和设计师社区。`)
};

/**
* | output |
* | --- |
* | "Join our community of developers and designers." |
*
* @param {Auth_Community_CtaInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const auth_community_cta = /** @type {((inputs?: Auth_Community_CtaInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Auth_Community_CtaInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_auth_community_cta(inputs)
	return zh_auth_community_cta(inputs)
});