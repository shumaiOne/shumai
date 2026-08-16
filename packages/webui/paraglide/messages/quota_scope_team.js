/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Scope_TeamInputs */

const en_quota_scope_team = /** @type {(inputs: Quota_Scope_TeamInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Entire Team`)
};

const zh_quota_scope_team = /** @type {(inputs: Quota_Scope_TeamInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`整个团队`)
};

/**
* | output |
* | --- |
* | "Entire Team" |
*
* @param {Quota_Scope_TeamInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_team = /** @type {((inputs?: Quota_Scope_TeamInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Scope_TeamInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_scope_team(inputs)
	return zh_quota_scope_team(inputs)
});