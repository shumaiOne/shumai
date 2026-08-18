/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ value: NonNullable<unknown> }} Quota_Target_ServerInputs */

const en_quota_target_server = /** @type {(inputs: Quota_Target_ServerInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Server: ${i?.value}`)
};

const zh_quota_target_server = /** @type {(inputs: Quota_Target_ServerInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`服务：${i?.value}`)
};

/**
* | output |
* | --- |
* | "Server: {value}" |
*
* @param {Quota_Target_ServerInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_target_server = /** @type {((inputs: Quota_Target_ServerInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Target_ServerInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_target_server(inputs)
	return zh_quota_target_server(inputs)
});