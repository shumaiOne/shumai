/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mcp_Test_FailedInputs */

const en_mcp_test_failed = /** @type {(inputs: Mcp_Test_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`MCP server test failed`)
};

const zh_mcp_test_failed = /** @type {(inputs: Mcp_Test_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`MCP 服务测试失败`)
};

/**
* | output |
* | --- |
* | "MCP server test failed" |
*
* @param {Mcp_Test_FailedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const mcp_test_failed = /** @type {((inputs?: Mcp_Test_FailedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mcp_Test_FailedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mcp_test_failed(inputs)
	return zh_mcp_test_failed(inputs)
});