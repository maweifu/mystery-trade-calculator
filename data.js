
/**
 * 《诡秘之主》商路收益计算器
 * 默认数据：站点、区域、地图坐标、道路、商品
 *
 * 注意：
 * 1. x、y 使用 0—100 的百分比坐标。
 * 2. 道路与坐标相互独立，调整站点位置不会自动改变道路连接。
 * 3. 道路 connections 当前为空，待依据地图实际道路补全。
 * 4. 商品价格、重量暂不虚构，录入后才能准确计算收益。
 */

(function () {
  "use strict";

  
	const stations = [
	  // 雪山区
	  { id: "snow_east", name: "雪山东部", region: "雪山区", x: 19.4, y: 57.5 },
	  { id: "snow_north", name: "雪山北部", region: "雪山区", x: 13.2, y: 49.3 },
	  { id: "snow_south", name: "雪山南部", region: "雪山区", x: 10.7, y: 64.2 },

	  // 花海区
	  { id: "flower_north", name: "花海北部", region: "花海区", x: 30.9, y: 77.4 },
	  { id: "flower_west", name: "花海西部", region: "花海区", x: 24.7, y: 85.5 },
	  { id: "flower_south", name: "花海南部", region: "花海区", x: 32.8, y: 92.1 },

	  // 小镇区
	  { id: "town_west", name: "小镇西部", region: "小镇区", x: 55.9, y: 82.3 },
	  { id: "town_east", name: "小镇东部", region: "小镇区", x: 63.0, y: 79.6 },

	  // 廷根区
	  { id: "tingen_station", name: "廷根车站", region: "廷根区", x: 64.6, y: 42.8 },
	  { id: "tingen_center", name: "廷根中央", region: "廷根区", x: 63.5, y: 57.6 },
	  { id: "tingen_port", name: "廷根港口", region: "廷根区", x: 56.0, y: 55.2 },
	  { id: "tingen_university", name: "廷根大学", region: "廷根区", x: 73.5, y: 53.9 },
	  { id: "tingen_south", name: "廷根南", region: "廷根区", x: 59.7, y: 68.1 },
	  { id: "tingen_southeast", name: "廷根东南", region: "廷根区", x: 69.2, y: 64.1 },
	  { id: "tingen_northeast", name: "廷根东北", region: "廷根区", x: 73.0, y: 40.4 },
	  { id: "tingen_northwest", name: "廷根西北", region: "廷根区", x: 56.1, y: 40.4 },

	  // 古堡区
	  { id: "castle_south", name: "古堡南部", region: "古堡区", x: 59.5, y: 21.0 },
	  { id: "castle_north", name: "古堡北部", region: "古堡区", x: 54.3, y: 10.2 },
	  { id: "castle_west", name: "古堡西部", region: "古堡区", x: 48.5, y: 17.3 },

	  // 金秋湖区
	  { id: "autumn_lake_west", name: "金秋湖西", region: "金秋湖区", x: 73.1, y: 13.0 },
	  { id: "autumn_lake_east", name: "金秋湖东", region: "金秋湖区", x: 79.9, y: 19.9 },
	  { id: "autumn_lake_north", name: "金秋湖北", region: "金秋湖区", x: 80.6, y: 5.9 }
	];


  const regions = [
    { id: "castle", name: "古堡区" },
    { id: "autumn_lake", name: "金秋湖区" },
    { id: "tingen", name: "廷根区" },
    { id: "snow", name: "雪山区" },
    { id: "flower", name: "花海区" },
    { id: "town", name: "小镇区" }
  ];

  // 道路单独维护，不根据站点坐标自动推导。
  // 每条道路连接两个站点，后续可添加曲线路径控制点。
  
	const roads = {
	  connections: [
		// 雪山区：5 条
		{ id: "road_01", from: "snow_north", to: "snow_south" },
		{ id: "road_02", from: "snow_north", to: "snow_east" },
		{ id: "road_03", from: "snow_south", to: "snow_east" },
		{ id: "road_04", from: "snow_east", to: "flower_west" },
		{ id: "road_05", from: "snow_east", to: "castle_south" },

		// 花海区：4 条
		{ id: "road_06", from: "flower_west", to: "flower_north" },
		{ id: "road_07", from: "flower_west", to: "flower_south" },
		{ id: "road_08", from: "flower_north", to: "flower_south" },
		{ id: "road_09", from: "flower_north", to: "tingen_northwest" },

		// 花海与小镇：1 条
		{ id: "road_10", from: "flower_south", to: "town_west" },

		// 小镇区：2 条
		{ id: "road_11", from: "town_west", to: "town_east" },
		{ id: "road_12", from: "town_east", to: "tingen_south" },

		// 廷根区及其外部连接：16 条
		{ id: "road_13", from: "tingen_south", to: "tingen_port" },
		{ id: "road_14", from: "tingen_south", to: "tingen_center" },
		{ id: "road_15", from: "tingen_south", to: "tingen_southeast" },
		{ id: "road_16", from: "tingen_southeast", to: "tingen_center" },
		{ id: "road_17", from: "tingen_southeast", to: "tingen_university" },
		{ id: "road_18", from: "tingen_center", to: "tingen_northwest" },
		{ id: "road_19", from: "tingen_center", to: "tingen_station" },
		{ id: "road_20", from: "tingen_center", to: "tingen_northeast" },
		{ id: "road_21", from: "tingen_port", to: "tingen_northwest" },
		{ id: "road_22", from: "tingen_university", to: "tingen_northeast" },
		{ id: "road_23", from: "tingen_northwest", to: "tingen_station" },
		{ id: "road_24", from: "tingen_northeast", to: "tingen_station" },
		{ id: "road_25", from: "tingen_northeast", to: "tingen_southeast" },
		{ id: "road_26", from: "tingen_northeast", to: "autumn_lake_east" },
		{ id: "road_27", from: "tingen_station", to: "castle_south" },

		// 古堡区：4 条
		{ id: "road_28", from: "castle_south", to: "castle_west" },
		{ id: "road_29", from: "castle_south", to: "castle_north" },
		{ id: "road_30", from: "castle_west", to: "castle_north" },
		{ id: "road_31", from: "castle_south", to: "autumn_lake_west" },

		// 金秋湖区：2 条
		{ id: "road_32", from: "autumn_lake_west", to: "autumn_lake_east" },
		{ id: "road_33", from: "autumn_lake_east", to: "autumn_lake_north" }
	  ]
	};


  // 商品价格、重量未确认前使用 null，避免误算收益。
  const products = [
    {
      id: "product_001",
      name: "待录入商品 1",
      weight: null,
      prices: {},
      isMock: true,
      note: "请录入商品重量及各站点买入价、卖出价"
    },
    {
      id: "product_002",
      name: "待录入商品 2",
      weight: null,
      prices: {},
      isMock: true,
      note: "请录入商品重量及各站点买入价、卖出价"
    },
    {
      id: "product_003",
      name: "待录入商品 3",
      weight: null,
      prices: {},
      isMock: true,
      note: "请录入商品重量及各站点买入价、卖出价"
    }
  ];

  window.TradeDefaultData = {
    schemaVersion: 1,
    stations,
    regions,
    roads,
    products,
    settings: {
      warehouseCapacity: 100,
      currencyName: "金币"
    }
  };
})();
