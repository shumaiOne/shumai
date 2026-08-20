/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ReporterInputs */

const en_reporter = /** @type {(inputs: ReporterInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reporter / Reviewer`)
};

const zh_reporter = /** @type {(inputs: ReporterInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`报告人 / 审核人`)
};

/**
* | output |
* | --- |
* | "Reporter / Reviewer" |
*
* @param {ReporterInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const reporter = /** @type {((inputs?: ReporterInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ReporterInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_reporter(inputs)
	return zh_reporter(inputs)
});