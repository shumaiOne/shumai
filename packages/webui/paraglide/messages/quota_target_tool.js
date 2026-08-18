/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ value: NonNullable<unknown> }} Quota_Target_ToolInputs */

const en_quota_target_tool = /** @type {(inputs: Quota_Target_ToolInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Tool: ${i?.value}`)
};

const zh_quota_target_tool = /** @type {(inputs: Quota_Target_ToolInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`工具：${i?.value}`)
};

/**
* | output |
* | --- |
* | "Tool: {value}" |
*
* @param {Quota_Target_ToolInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_target_tool = /** @type {((inputs: Quota_Target_ToolInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Target_ToolInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_target_tool(inputs)
	return zh_quota_target_tool(inputs)
});