/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Test_ConnectionInputs */

const en_mcp_test_connection = /** @type {(inputs: Mcp_Test_ConnectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Test Connection`)
};

const zh_mcp_test_connection = /** @type {(inputs: Mcp_Test_ConnectionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`测试连接`)
};

/**
* | output |
* | --- |
* | "Test Connection" |
*
* @param {Mcp_Test_ConnectionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_test_connection = /** @type {((inputs?: Mcp_Test_ConnectionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Test_ConnectionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_test_connection(inputs)
	return zh_mcp_test_connection(inputs)
});