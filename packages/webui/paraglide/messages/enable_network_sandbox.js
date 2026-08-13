/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Enable_Network_SandboxInputs */

const en_enable_network_sandbox = /** @type {(inputs: Enable_Network_SandboxInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enable Network Sandbox`)
};

const zh_enable_network_sandbox = /** @type {(inputs: Enable_Network_SandboxInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`启用网络沙箱`)
};

/**
* | output |
* | --- |
* | "Enable Network Sandbox" |
*
* @param {Enable_Network_SandboxInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enable_network_sandbox = /** @type {((inputs?: Enable_Network_SandboxInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Enable_Network_SandboxInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_enable_network_sandbox(inputs)
	return zh_enable_network_sandbox(inputs)
});