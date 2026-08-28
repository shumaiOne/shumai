/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Playback_SpeedInputs */

const en_playback_speed = /** @type {(inputs: Playback_SpeedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Playback Speed`)
};

const zh_playback_speed = /** @type {(inputs: Playback_SpeedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`播放速度`)
};

/**
* | output |
* | --- |
* | "Playback Speed" |
*
* @param {Playback_SpeedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const playback_speed = /** @type {((inputs?: Playback_SpeedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Playback_SpeedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_playback_speed(inputs)
	return zh_playback_speed(inputs)
});