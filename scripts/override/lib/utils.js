/**
 * 通过 JSON 序列化/反序列化实现深拷贝。
 * 注意: 不支持 Date、RegExp、函数等非 JSON 安全类型，
 * 但本项目的配置数据均为纯 JSON 兼容对象，因此安全适用。
 * @param {unknown} value - 待拷贝的值。
 * @returns {unknown} 深拷贝后的副本。
 */
function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

export { cloneData };
