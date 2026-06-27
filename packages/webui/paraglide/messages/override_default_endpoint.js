/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Override_Default_EndpointInputs */

const en_override_default_endpoint = /** @type {(inputs: Override_Default_EndpointInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Override the default endpoint.`)
};

const zh_override_default_endpoint = /** @type {(inputs: Override_Default_EndpointInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`覆盖默认端点。`)
};

/**
* | output |
* | --- |
* | "Override the default endpoint." |
*
* @param {Override_Default_EndpointInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const override_default_endpoint = /** @type {((inputs?: Override_Default_EndpointInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Override_Default_EndpointInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_override_default_endpoint(inputs)
	return zh_override_default_endpoint(inputs)
});