/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Test_SuccessInputs */

const en_mcp_test_success = /** @type {(inputs: Mcp_Test_SuccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`MCP server test successful`)
};

const zh_mcp_test_success = /** @type {(inputs: Mcp_Test_SuccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`MCP 服务测试成功`)
};

/**
* | output |
* | --- |
* | "MCP server test successful" |
*
* @param {Mcp_Test_SuccessInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_test_success = /** @type {((inputs?: Mcp_Test_SuccessInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Test_SuccessInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_test_success(inputs)
	return zh_mcp_test_success(inputs)
});