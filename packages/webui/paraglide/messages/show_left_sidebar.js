/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Show_Left_SidebarInputs */

const en_show_left_sidebar = /** @type {(inputs: Show_Left_SidebarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Show Left Sidebar`)
};

const zh_show_left_sidebar = /** @type {(inputs: Show_Left_SidebarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`显示左侧边栏`)
};

/**
* | output |
* | --- |
* | "Show Left Sidebar" |
*
* @param {Show_Left_SidebarInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const show_left_sidebar = /** @type {((inputs?: Show_Left_SidebarInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Show_Left_SidebarInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_show_left_sidebar(inputs)
	return zh_show_left_sidebar(inputs)
});