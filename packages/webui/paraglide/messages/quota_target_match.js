/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ value: NonNullable<unknown> }} Quota_Target_MatchInputs */

const en_quota_target_match = /** @type {(inputs: Quota_Target_MatchInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Match: ${i?.value}`)
};

const zh_quota_target_match = /** @type {(inputs: Quota_Target_MatchInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`匹配：${i?.value}`)
};

/**
* | output |
* | --- |
* | "Match: {value}" |
*
* @param {Quota_Target_MatchInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_target_match = /** @type {((inputs: Quota_Target_MatchInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Target_MatchInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_target_match(inputs)
	return zh_quota_target_match(inputs)
});