/**
* | output |
* | --- |
* | "Role Shared Pool" |
*
* @param {Quota_Role_Shared_PoolInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_role_shared_pool: ((inputs?: Quota_Role_Shared_PoolInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Role_Shared_PoolInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Role_Shared_PoolInputs = {};
