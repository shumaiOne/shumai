/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_ReporterInputs */

const en_select_reporter = /** @type {(inputs: Select_ReporterInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select Reporter`)
};

const zh_select_reporter = /** @type {(inputs: Select_ReporterInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择报告人`)
};

/**
* | output |
* | --- |
* | "Select Reporter" |
*
* @param {Select_ReporterInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_reporter = /** @type {((inputs?: Select_ReporterInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_ReporterInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_reporter(inputs)
	return zh_select_reporter(inputs)
});