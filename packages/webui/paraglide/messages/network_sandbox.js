/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Network_SandboxInputs */

const en_network_sandbox = /** @type {(inputs: Network_SandboxInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Network Sandbox`)
};

const zh_network_sandbox = /** @type {(inputs: Network_SandboxInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`网络沙箱`)
};

/**
* | output |
* | --- |
* | "Network Sandbox" |
*
* @param {Network_SandboxInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const network_sandbox = /** @type {((inputs?: Network_SandboxInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Network_SandboxInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_network_sandbox(inputs)
	return zh_network_sandbox(inputs)
});