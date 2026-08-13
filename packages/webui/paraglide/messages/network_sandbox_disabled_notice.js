/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Network_Sandbox_Disabled_NoticeInputs */

const en_network_sandbox_disabled_notice = /** @type {(inputs: Network_Sandbox_Disabled_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Network Sandbox is currently OFF. All outbound network requests from agent scripts are permitted without restrictions.`)
};

const zh_network_sandbox_disabled_notice = /** @type {(inputs: Network_Sandbox_Disabled_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`网络沙箱目前处于关闭状态。智能体脚本的所有出站网络请求均不受限制。`)
};

/**
* | output |
* | --- |
* | "Network Sandbox is currently OFF. All outbound network requests from agent scripts are permitted without restrictions." |
*
* @param {Network_Sandbox_Disabled_NoticeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const network_sandbox_disabled_notice = /** @type {((inputs?: Network_Sandbox_Disabled_NoticeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Network_Sandbox_Disabled_NoticeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_network_sandbox_disabled_notice(inputs)
	return zh_network_sandbox_disabled_notice(inputs)
});