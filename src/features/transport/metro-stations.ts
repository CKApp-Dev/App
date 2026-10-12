// Taipei Metro station locations used for local nearest-station lookup.
// Coordinates are bundled so location lookup works without another network request.

import { distanceKm } from './youbike';

export interface MetroStation {
  name: string;
  latitude: number;
  longitude: number;
}

export const METRO_STATIONS: readonly MetroStation[] = [
  {
    "name": "動物園",
    "latitude": 24.998197,
    "longitude": 121.579338
  },
  {
    "name": "木柵",
    "latitude": 24.998241,
    "longitude": 121.573145
  },
  {
    "name": "萬芳社區",
    "latitude": 24.998585,
    "longitude": 121.568102
  },
  {
    "name": "萬芳醫院",
    "latitude": 24.999386,
    "longitude": 121.558152
  },
  {
    "name": "辛亥",
    "latitude": 25.005475,
    "longitude": 121.557107
  },
  {
    "name": "麟光",
    "latitude": 25.018535,
    "longitude": 121.558791
  },
  {
    "name": "六張犁",
    "latitude": 25.023777,
    "longitude": 121.553115
  },
  {
    "name": "科技大樓",
    "latitude": 25.026125,
    "longitude": 121.543437
  },
  {
    "name": "大安",
    "latitude": 25.032943,
    "longitude": 121.543551
  },
  {
    "name": "忠孝復興",
    "latitude": 25.041629,
    "longitude": 121.543767
  },
  {
    "name": "南京復興",
    "latitude": 25.052319,
    "longitude": 121.544011
  },
  {
    "name": "中山國中",
    "latitude": 25.060849,
    "longitude": 121.544227
  },
  {
    "name": "松山機場",
    "latitude": 25.063,
    "longitude": 121.551996
  },
  {
    "name": "大直",
    "latitude": 25.079477,
    "longitude": 121.546895
  },
  {
    "name": "劍南路",
    "latitude": 25.084853,
    "longitude": 121.555592
  },
  {
    "name": "西湖",
    "latitude": 25.082133,
    "longitude": 121.567213
  },
  {
    "name": "港墘",
    "latitude": 25.080028,
    "longitude": 121.575081
  },
  {
    "name": "文德",
    "latitude": 25.078532,
    "longitude": 121.584761
  },
  {
    "name": "內湖",
    "latitude": 25.083661,
    "longitude": 121.594408
  },
  {
    "name": "大湖公園",
    "latitude": 25.083845,
    "longitude": 121.602141
  },
  {
    "name": "葫洲",
    "latitude": 25.072701,
    "longitude": 121.607158
  },
  {
    "name": "東湖",
    "latitude": 25.067147,
    "longitude": 121.611445
  },
  {
    "name": "南港軟體園區",
    "latitude": 25.059905,
    "longitude": 121.615953
  },
  {
    "name": "南港展覽館",
    "latitude": 25.055288,
    "longitude": 121.6175001
  },
  {
    "name": "象山",
    "latitude": 25.03283,
    "longitude": 121.569576
  },
  {
    "name": "台北101/世貿",
    "latitude": 25.033102,
    "longitude": 121.563292
  },
  {
    "name": "信義安和",
    "latitude": 25.033326,
    "longitude": 121.553526
  },
  {
    "name": "大安森林公園",
    "latitude": 25.033396,
    "longitude": 121.534882
  },
  {
    "name": "東門",
    "latitude": 25.033847,
    "longitude": 121.528739
  },
  {
    "name": "中正紀念堂",
    "latitude": 25.032729,
    "longitude": 121.51827
  },
  {
    "name": "台大醫院",
    "latitude": 25.041256,
    "longitude": 121.51604
  },
  {
    "name": "台北車站",
    "latitude": 25.046255,
    "longitude": 121.517532
  },
  {
    "name": "中山",
    "latitude": 25.052685,
    "longitude": 121.520392
  },
  {
    "name": "雙連",
    "latitude": 25.057805,
    "longitude": 121.520627
  },
  {
    "name": "民權西路",
    "latitude": 25.062905,
    "longitude": 121.51932
  },
  {
    "name": "圓山",
    "latitude": 25.071353,
    "longitude": 121.520118
  },
  {
    "name": "劍潭",
    "latitude": 25.084873,
    "longitude": 121.525078
  },
  {
    "name": "士林",
    "latitude": 25.093535,
    "longitude": 121.52623
  },
  {
    "name": "芝山",
    "latitude": 25.10306,
    "longitude": 121.522514
  },
  {
    "name": "明德",
    "latitude": 25.109721,
    "longitude": 121.518848
  },
  {
    "name": "石牌",
    "latitude": 25.114523,
    "longitude": 121.515559
  },
  {
    "name": "唭哩岸",
    "latitude": 25.120872,
    "longitude": 121.506252
  },
  {
    "name": "奇岩",
    "latitude": 25.125491,
    "longitude": 121.501132
  },
  {
    "name": "北投",
    "latitude": 25.131841,
    "longitude": 121.498633
  },
  {
    "name": "新北投",
    "latitude": 25.136933,
    "longitude": 121.50253
  },
  {
    "name": "復興崗",
    "latitude": 25.137474,
    "longitude": 121.485444
  },
  {
    "name": "忠義",
    "latitude": 25.130969,
    "longitude": 121.47341
  },
  {
    "name": "關渡",
    "latitude": 25.125633,
    "longitude": 121.467102
  },
  {
    "name": "竹圍",
    "latitude": 25.13694,
    "longitude": 121.459479
  },
  {
    "name": "紅樹林",
    "latitude": 25.154042,
    "longitude": 121.458872
  },
  {
    "name": "淡水",
    "latitude": 25.167818,
    "longitude": 121.445561
  },
  {
    "name": "新店",
    "latitude": 24.957855,
    "longitude": 121.537584
  },
  {
    "name": "新店區公所",
    "latitude": 24.967393,
    "longitude": 121.54131
  },
  {
    "name": "七張",
    "latitude": 24.975169,
    "longitude": 121.542942
  },
  {
    "name": "小碧潭",
    "latitude": 24.971907,
    "longitude": 121.530339
  },
  {
    "name": "大坪林",
    "latitude": 24.982899,
    "longitude": 121.541352
  },
  {
    "name": "景美",
    "latitude": 24.9921276,
    "longitude": 121.5406037
  },
  {
    "name": "萬隆",
    "latitude": 25.001853,
    "longitude": 121.539051
  },
  {
    "name": "公館",
    "latitude": 25.014908,
    "longitude": 121.534216
  },
  {
    "name": "台電大樓",
    "latitude": 25.020725,
    "longitude": 121.528168
  },
  {
    "name": "古亭",
    "latitude": 25.026357,
    "longitude": 121.522873
  },
  {
    "name": "小南門",
    "latitude": 25.035547,
    "longitude": 121.510857
  },
  {
    "name": "西門",
    "latitude": 25.04209,
    "longitude": 121.508303
  },
  {
    "name": "北門",
    "latitude": 25.049554,
    "longitude": 121.510184
  },
  {
    "name": "松江南京",
    "latitude": 25.052015,
    "longitude": 121.533075
  },
  {
    "name": "台北小巨蛋",
    "latitude": 25.051836,
    "longitude": 121.55153
  },
  {
    "name": "南京三民",
    "latitude": 25.051652,
    "longitude": 121.564708
  },
  {
    "name": "松山",
    "latitude": 25.049283,
    "longitude": 121.578012
  },
  {
    "name": "南勢角",
    "latitude": 24.990045,
    "longitude": 121.509237
  },
  {
    "name": "景安",
    "latitude": 24.993905,
    "longitude": 121.505113
  },
  {
    "name": "永安市場",
    "latitude": 25.002876,
    "longitude": 121.511231
  },
  {
    "name": "頂溪",
    "latitude": 25.013821,
    "longitude": 121.515485
  },
  {
    "name": "忠孝新生",
    "latitude": 25.042356,
    "longitude": 121.532905
  },
  {
    "name": "行天宮",
    "latitude": 25.059718,
    "longitude": 121.533185
  },
  {
    "name": "中山國小",
    "latitude": 25.062694,
    "longitude": 121.526419
  },
  {
    "name": "大橋頭",
    "latitude": 25.063256,
    "longitude": 121.51272
  },
  {
    "name": "台北橋",
    "latitude": 25.063274,
    "longitude": 121.500762
  },
  {
    "name": "菜寮",
    "latitude": 25.060274,
    "longitude": 121.492156
  },
  {
    "name": "三重",
    "latitude": 25.055791,
    "longitude": 121.484725
  },
  {
    "name": "先嗇宮",
    "latitude": 25.046493,
    "longitude": 121.471916
  },
  {
    "name": "頭前庄",
    "latitude": 25.039705,
    "longitude": 121.461746
  },
  {
    "name": "新莊",
    "latitude": 25.036125,
    "longitude": 121.452468
  },
  {
    "name": "輔大",
    "latitude": 25.032718,
    "longitude": 121.43547
  },
  {
    "name": "丹鳳",
    "latitude": 25.0288671,
    "longitude": 121.4227079
  },
  {
    "name": "迴龍",
    "latitude": 25.021862,
    "longitude": 121.41127
  },
  {
    "name": "三重國小",
    "latitude": 25.070319,
    "longitude": 121.496904
  },
  {
    "name": "三和國中",
    "latitude": 25.076859,
    "longitude": 121.486347
  },
  {
    "name": "徐匯中學",
    "latitude": 25.080728,
    "longitude": 121.479673
  },
  {
    "name": "三民高中",
    "latitude": 25.085456,
    "longitude": 121.473389
  },
  {
    "name": "蘆洲",
    "latitude": 25.091554,
    "longitude": 121.464471
  },
  {
    "name": "頂埔",
    "latitude": 24.96012,
    "longitude": 121.4205
  },
  {
    "name": "永寧",
    "latitude": 24.966726,
    "longitude": 121.436072
  },
  {
    "name": "土城",
    "latitude": 24.973094,
    "longitude": 121.444362
  },
  {
    "name": "海山",
    "latitude": 24.985339,
    "longitude": 121.448786
  },
  {
    "name": "亞東醫院",
    "latitude": 24.998037,
    "longitude": 121.452514
  },
  {
    "name": "府中",
    "latitude": 25.008619,
    "longitude": 121.459409
  },
  {
    "name": "板橋",
    "latitude": 25.013618,
    "longitude": 121.462302
  },
  {
    "name": "新埔",
    "latitude": 25.023738,
    "longitude": 121.468361
  },
  {
    "name": "江子翠",
    "latitude": 25.03001,
    "longitude": 121.47239
  },
  {
    "name": "龍山寺",
    "latitude": 25.03528,
    "longitude": 121.499826
  },
  {
    "name": "善導寺",
    "latitude": 25.044823,
    "longitude": 121.523208
  },
  {
    "name": "忠孝敦化",
    "latitude": 25.041478,
    "longitude": 121.551098
  },
  {
    "name": "國父紀念館",
    "latitude": 25.041349,
    "longitude": 121.557802
  },
  {
    "name": "市政府",
    "latitude": 25.041171,
    "longitude": 121.565228
  },
  {
    "name": "永春",
    "latitude": 25.040859,
    "longitude": 121.576293
  },
  {
    "name": "後山埤",
    "latitude": 25.045055,
    "longitude": 121.582522
  },
  {
    "name": "昆陽",
    "latitude": 25.050461,
    "longitude": 121.593268
  },
  {
    "name": "南港",
    "latitude": 25.052116,
    "longitude": 121.606686
  }
];

export interface MetroStationWithDistance extends MetroStation {
  distanceKm: number;
}

export function nearestMetroStation(latitude: number, longitude: number): MetroStationWithDistance | undefined {
  return METRO_STATIONS
    .map((station) => ({ ...station, distanceKm: distanceKm(latitude, longitude, station.latitude, station.longitude) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
}
