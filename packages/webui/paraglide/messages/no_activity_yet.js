/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Activity_YetInputs */

const en_no_activity_yet = /** @type {(inputs: No_Activity_YetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No activity recorded yet`)
};

const zh_no_activity_yet = /** @type {(inputs: No_Activity_YetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无活动记录`)
};

/**
* | output |
* | --- |
* | "No activity recorded yet" |
*
* @param {No_Activity_YetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_activity_yet = /** @type {((inputs?: No_Activity_YetInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Activity_YetInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_activity_yet(inputs)
	return zh_no_activity_yet(inputs)
});