// Only pass the server-produced public topic query; never the user's chat text.
export function platformSearchLinks(publicQuery: string) {
  const terms = publicQuery.split(' site:')[0].trim().slice(0, 100);
  if (!terms) return [];
  const q = encodeURIComponent(terms);
  return [
    { label: 'Bilibili', url: `https://search.bilibili.com/all?keyword=${q}` },
    { label: '小红书', url: `https://www.xiaohongshu.com/search_result?keyword=${q}` },
    { label: '百度贴吧', url: `https://tieba.baidu.com/f/search/res?ie=utf-8&qw=${q}` },
    { label: '抖音', url: `https://www.douyin.com/search/${q}` },
  ];
}
