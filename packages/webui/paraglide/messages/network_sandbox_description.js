/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Network_Sandbox_DescriptionInputs */

const en_network_sandbox_description = /** @type {(inputs: Network_Sandbox_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Configure domain access controls for the sandboxed agent.`)
};

const zh_network_sandbox_description = /** @type {(inputs: Network_Sandbox_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`配置沙箱智能体的域名访问控制。`)
};

/**
* | output |
* | --- |
* | "Configure domain access controls for the sandboxed agent." |
*
* @param {Network_Sandbox_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const network_sandbox_description = /** @type {((inputs?: Network_Sandbox_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Network_Sandbox_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_network_sandbox_description(inputs)
	return zh_network_sandbox_description(inputs)
});