/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Scope_ModeInputs */

const en_quota_scope_mode = /** @type {(inputs: Quota_Scope_ModeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Target Mode`)
};

const zh_quota_scope_mode = /** @type {(inputs: Quota_Scope_ModeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`目标模式`)
};

/**
* | output |
* | --- |
* | "Target Mode" |
*
* @param {Quota_Scope_ModeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_mode = /** @type {((inputs?: Quota_Scope_ModeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Scope_ModeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_scope_mode(inputs)
	return zh_quota_scope_mode(inputs)
});