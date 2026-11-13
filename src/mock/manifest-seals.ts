// 用户提供的联单印章原图，随项目独立打包。
export const manifestSeals = {
 carrier: new URL('./seals/carrier.png', import.meta.url).href,
 processor: new URL('./seals/processor.png', import.meta.url).href,
};

// 矢量章文字沿用用户确认的两枚印章。
export const manifestSealCaptions = {
 processor: '温江区餐厨处理中心',
 purpose: '五联单专用章',
};
