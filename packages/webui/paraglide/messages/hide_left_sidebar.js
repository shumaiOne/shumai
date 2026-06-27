/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hide_Left_SidebarInputs */

const en_hide_left_sidebar = /** @type {(inputs: Hide_Left_SidebarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Hide Left Sidebar`)
};

const zh_hide_left_sidebar = /** @type {(inputs: Hide_Left_SidebarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`隐藏左侧边栏`)
};

/**
* | output |
* | --- |
* | "Hide Left Sidebar" |
*
* @param {Hide_Left_SidebarInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hide_left_sidebar = /** @type {((inputs?: Hide_Left_SidebarInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hide_Left_SidebarInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_hide_left_sidebar(inputs)
	return zh_hide_left_sidebar(inputs)
});