/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_DisabledInputs */

const en_quota_disabled = /** @type {(inputs: Quota_DisabledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Disabled`)
};

const zh_quota_disabled = /** @type {(inputs: Quota_DisabledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已禁用`)
};

/**
* | output |
* | --- |
* | "Disabled" |
*
* @param {Quota_DisabledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_disabled = /** @type {((inputs?: Quota_DisabledInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_DisabledInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_disabled(inputs)
	return zh_quota_disabled(inputs)
});