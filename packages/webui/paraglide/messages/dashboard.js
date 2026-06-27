/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} DashboardInputs */

const en_dashboard = /** @type {(inputs: DashboardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Dashboard`)
};

const zh_dashboard = /** @type {(inputs: DashboardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`控制台`)
};

/**
* | output |
* | --- |
* | "Dashboard" |
*
* @param {DashboardInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const dashboard = /** @type {((inputs?: DashboardInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<DashboardInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_dashboard(inputs)
	return zh_dashboard(inputs)
});