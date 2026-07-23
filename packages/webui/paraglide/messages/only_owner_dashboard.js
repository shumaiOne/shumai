/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Only_Owner_DashboardInputs */

const en_only_owner_dashboard = /** @type {(inputs: Only_Owner_DashboardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Only team owners can access the dashboard.`)
};

const zh_only_owner_dashboard = /** @type {(inputs: Only_Owner_DashboardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`只有团队所有者才能访问仪表盘。`)
};

/**
* | output |
* | --- |
* | "Only team owners can access the dashboard." |
*
* @param {Only_Owner_DashboardInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const only_owner_dashboard = /** @type {((inputs?: Only_Owner_DashboardInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Only_Owner_DashboardInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_only_owner_dashboard(inputs)
	return zh_only_owner_dashboard(inputs)
});