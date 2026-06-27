/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Provider_Is_RequiredInputs */

const en_provider_is_required = /** @type {(inputs: Provider_Is_RequiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Provider is required`)
};

const zh_provider_is_required = /** @type {(inputs: Provider_Is_RequiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`提供商为必填项`)
};

/**
* | output |
* | --- |
* | "Provider is required" |
*
* @param {Provider_Is_RequiredInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provider_is_required = /** @type {((inputs?: Provider_Is_RequiredInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Provider_Is_RequiredInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_provider_is_required(inputs)
	return zh_provider_is_required(inputs)
});