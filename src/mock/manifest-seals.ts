// 用户提供的联单印章原图，随项目独立打包。
export const manifestSeals = {
 carrier: new URL('./seals/carrier.png', import.meta.url).href,
 processor: new URL('./seals/processor.png', import.meta.url).href,
};
