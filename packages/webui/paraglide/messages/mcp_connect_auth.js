/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Connect_AuthInputs */

const en_mcp_connect_auth = /** @type {(inputs: Mcp_Connect_AuthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Connect Account`)
};

const zh_mcp_connect_auth = /** @type {(inputs: Mcp_Connect_AuthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`连接账号`)
};

/**
* | output |
* | --- |
* | "Connect Account" |
*
* @param {Mcp_Connect_AuthInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_connect_auth = /** @type {((inputs?: Mcp_Connect_AuthInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Connect_AuthInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_connect_auth(inputs)
	return zh_mcp_connect_auth(inputs)
});