/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Changes_Requested_ReasonInputs */

const en_changes_requested_reason = /** @type {(inputs: Changes_Requested_ReasonInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reason for changes requested`)
};

const zh_changes_requested_reason = /** @type {(inputs: Changes_Requested_ReasonInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`请求修改的原因`)
};

/**
* | output |
* | --- |
* | "Reason for changes requested" |
*
* @param {Changes_Requested_ReasonInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const changes_requested_reason = /** @type {((inputs?: Changes_Requested_ReasonInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Changes_Requested_ReasonInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_changes_requested_reason(inputs)
	return zh_changes_requested_reason(inputs)
});