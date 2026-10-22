
/**
 * 《诡秘之主》商路收益计算器
 * app.js - 页面交互、地图渲染、交易计算、数据编辑与自动保存
 *
 * 依赖顺序：
 * 1. data.js
 * 2. storage.js
 * 3. app.js
 */

(function () {
  "use strict";

  if (!window.TradeDefaultData || !window.TradeStorage) {
    console.error("初始化失败：请检查 data.js 和 storage.js 是否已加载。");
    return;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  // 读取本地数据；没有本地数据时使用默认数据。
  let appData = window.TradeStorage.load();

  // 当前选中的站点。
  let selectedStationId =
    appData.stations[0] ? appData.stations[0].id : null;

  let currentTab = "station";
  let saveStatus = "尚未修改";
  let calculatorResult = null;

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function formatNumber(value) {
    return Number(value).toLocaleString("zh-CN", {
      maximumFractionDigits: 2
    });
  }

  function parseNumber(value) {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getStation(stationId) {
    return appData.stations.find(
      station => station.id === stationId
    );
  }

  function getProduct(productId) {
    return appData.products.find(
      product => product.id === productId
    );
  }

  function getPrice(product, stationId) {
    if (!product || !product.prices) {
      return { buy: null, sell: null };
    }

    const price = product.prices[stationId] || {};

    return {
      buy: parseNumber(price.buy),
      sell: parseNumber(price.sell)
    };
  }

  function setSaveStatus(message) {
    saveStatus = message;

    let status = $("#tradeSaveStatus");

    if (!status) {
      status = document.createElement("span");
      status.id = "tradeSaveStatus";
      status.className = "trade-save-status";

      const header = $("header") || $(".app-header") || document.body;
      header.appendChild(status);
    }

    status.textContent = message;
    status.setAttribute("aria-live", "polite");
  }

  function markChanged() {
    setSaveStatus("正在保存…");

    window.TradeStorage.scheduleSave(appData);
  }

  window.addEventListener("trade-data-saved", function () {
    setSaveStatus("已自动保存");
  });

  window.addEventListener("trade-data-save-error", function (event) {
    const message = event.detail?.message || "未知错误";
    setSaveStatus("保存失败：" + message);
  });

  // --------------------------------------------------
  // 一、标签切换
  // --------------------------------------------------

	
	function switchTab(tabName) {
	  const allowedTabs = ["station", "calculator", "routes"];

	  if (!allowedTabs.includes(tabName)) return;

	  currentTab = tabName;

	  // 1. 更新所有导航按钮的选中状态
	  $$("[data-tab]").forEach(button => {
		const active = button.dataset.tab === tabName;

		button.classList.toggle("active", active);
		button.setAttribute("aria-selected", String(active));
		button.setAttribute("aria-current", active ? "page" : "false");
	  });

	  // 2. 更新内容面板的显示状态
	  allowedTabs.forEach(name => {
		const panel = document.getElementById("panel-" + name);
		if (!panel) {
		  console.error("找不到面板：#panel-" + name);
		  return;
		}

		const active = name === tabName;

		panel.hidden = !active;
		panel.style.display = active ? "block" : "none";
		panel.classList.toggle("active", active);
	  });

	  // 3. 刷新当前功能对应的内容
	  switch (tabName) {
		case "station":
		  renderStationPanel();
		  break;
		case "calculator":
		  renderCalculatorPanel();
		  break;
		case "routes":
		  renderRoutesPanel();
		  break;
	  }
	}



  // --------------------------------------------------
  // 二、地图 SVG
  // --------------------------------------------------

  function createSVGElement(tagName, attributes = {}) {
    const element = document.createElementNS(SVG_NS, tagName);

    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });

    return element;
  }

  function renderMap() {
    const stationLayer = $("#stationLayer");
    const roadLayer = $("#roadLayer");
    const highlightLayer = $("#highlightRouteLayer");

    if (!stationLayer) {
      console.warn("未找到 #stationLayer，请检查 index.html 中的 SVG ID。");
      return;
    }

    stationLayer.replaceChildren();

    if (roadLayer) roadLayer.replaceChildren();
    if (highlightLayer) highlightLayer.replaceChildren();

    // 绘制道路。没有确认的道路数据时，不擅自连线。
    if (roadLayer) {
      appData.roads.connections.forEach(road => {
        const from = getStation(road.from);
        const to = getStation(road.to);

        if (!from || !to) return;

        const x1 = from.x * 10;
        const y1 = from.y * 5.052;
        const x2 = to.x * 10;
        const y2 = to.y * 5.052;

        let pathData;

        if (Array.isArray(road.controlPoints) &&
            road.controlPoints.length > 0) {
          const control = road.controlPoints[0];

          pathData =
            `M ${x1} ${y1} Q ${control.x * 10} ${control.y * 4.16} ${x2} ${y2}`;
        } else {
          pathData = `M ${x1} ${y1} L ${x2} ${y2}`;
        }

        const path = createSVGElement("path", {
          d: pathData,
          class: "road-path",
          "data-road-id": road.id || "",
          fill: "none"
        });

        roadLayer.appendChild(path);
      });
    }

    // 所有站点默认显示名称。
        // 绘制站点交互节点，不重复绘制地图自带的站点名称。
    appData.stations.forEach(station => {
      const x = station.x * 10;
      const y = station.y * 5.052;

      const group = createSVGElement("g", {
        class:
          "station-node" +
          (station.id === selectedStationId ? " selected" : ""),
        "data-station-id": station.id,
        role: "button",
        tabindex: "0",
        "aria-label": station.name
      });

      // 保留站点圆点
      const circle = createSVGElement("circle", {
        cx: x,
        cy: y,
        r: station.id === selectedStationId ? 5 : 3.5
      });

      group.appendChild(circle);

      // 保留站点点击交互
      group.addEventListener("click", () => {
        selectStation(station.id);
      });

      group.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectStation(station.id);
        }
      });

      stationLayer.appendChild(group);
    });
  }

  function selectStation(stationId) {
    if (!getStation(stationId)) return;

    selectedStationId = stationId;

    renderMap();

    // 点击地图站点时，自动切换至站点信息。
    switchTab("station");
  }

  // --------------------------------------------------
  // 三、站点信息与商品编辑
  // --------------------------------------------------

  function renderStationPanel() {
    const panel = $("#panel-station");
    if (!panel) return;

    const station = getStation(selectedStationId);

    if (!station) {
      panel.innerHTML = "<p>暂无站点数据。</p>";
      return;
    }

    const productsHTML = appData.products.map(product => {
      const price = getPrice(product, station.id);

      return `
        <tr>
          <td>
            <input
              type="text"
              data-product-name="${escapeHTML(product.id)}"
              value="${escapeHTML(product.name)}"
              aria-label="商品名称"
            >
          </td>
          <td>
            <input
              type="number"
              min="0"
              step="any"
              data-product-weight="${escapeHTML(product.id)}"
              value="${product.weight ?? ""}"
              placeholder="待录入"
              aria-label="商品重量"
            >
          </td>
          <td>
            <input
              type="number"
              step="any"
              data-price-buy="${escapeHTML(product.id)}"
              value="${price.buy ?? ""}"
              placeholder="待录入"
              aria-label="本站买入价"
            >
          </td>
          <td>
            <input
              type="number"
              step="any"
              data-price-sell="${escapeHTML(product.id)}"
              value="${price.sell ?? ""}"
              placeholder="待录入"
              aria-label="本站卖出价"
            >
          </td>
        </tr>
      `;
    }).join("");

    panel.innerHTML = `
      <section class="station-detail">
        <h2>${escapeHTML(station.name)}</h2>
        <p>所属区域：${escapeHTML(station.region)}</p>

        <div class="trade-field-grid">
          <label>
            站点名称
            <input id="editStationName" type="text"
              value="${escapeHTML(station.name)}">
          </label>

          <label>
            所属区域
            <select id="editStationRegion">
              ${appData.regions.map(region => `
                <option value="${escapeHTML(region.name)}"
                  ${region.name === station.region ? "selected" : ""}>
                  ${escapeHTML(region.name)}
                </option>
              `).join("")}
            </select>
          </label>

          <label>
            地图横坐标（%）
            <input id="editStationX" type="number"
              min="0" max="100" step="0.1" value="${station.x}">
          </label>

          <label>
            地图纵坐标（%）
            <input id="editStationY" type="number"
              min="0" max="100" step="0.1" value="${station.y}">
          </label>
        </div>

        <h3>本站商品价格</h3>
        <p class="trade-muted">
          价格和重量需要根据实际游戏数据录入。留空表示未知，不会自动当作 0。
        </p>

        <div class="trade-table-wrap">
          <table class="trade-table">
            <thead>
              <tr>
                <th>商品</th>
                <th>重量</th>
                <th>买入价</th>
                <th>卖出价</th>
              </tr>
            </thead>
            <tbody>
              ${productsHTML}
            </tbody>
          </table>
        </div>

        <div class="trade-actions">
          <button type="button" id="addProductButton">新增商品</button>
          <button type="button" id="saveStationButton">保存本站修改</button>
        </div>
      </section>
    `;

    $("#saveStationButton", panel)?.addEventListener("click", saveStationEdits);
    $("#addProductButton", panel)?.addEventListener("click", addProduct);
  }

  function saveStationEdits() {
    const station = getStation(selectedStationId);
    if (!station) return;

    const name = $("#editStationName")?.value.trim();
    const region = $("#editStationRegion")?.value;
    const x = parseNumber($("#editStationX")?.value);
    const y = parseNumber($("#editStationY")?.value);

    if (!name) {
      alert("站点名称不能为空。");
      return;
    }

    if (x === null || y === null || x < 0 || x > 100 || y < 0 || y > 100) {
      alert("地图坐标必须填写 0—100 之间的数值。");
      return;
    }

    station.name = name;
    station.region = region;
    station.x = x;
    station.y = y;

    appData.products.forEach(product => {
      const productName = $(
        `[data-product-name="${CSS.escape(product.id)}"]`
      )?.value.trim();

      const weightValue = $(
        `[data-product-weight="${CSS.escape(product.id)}"]`
      )?.value;

      const buyValue = $(
        `[data-price-buy="${CSS.escape(product.id)}"]`
      )?.value;

      const sellValue = $(
        `[data-price-sell="${CSS.escape(product.id)}"]`
      )?.value;

      if (productName) product.name = productName;

      product.weight = parseNumber(weightValue);

      if (!product.prices) product.prices = {};

      product.prices[station.id] = {
        buy: parseNumber(buyValue),
        sell: parseNumber(sellValue)
      };

      product.isMock = false;
    });

    renderMap();
    renderStationPanel();
    markChanged();
  }

  function addProduct() {
    const id = "product_" + Date.now();

    appData.products.push({
      id,
      name: "新商品",
      weight: null,
      prices: {},
      isMock: false,
      note: ""
    });

    renderStationPanel();
    markChanged();
  }

  // --------------------------------------------------
  // 四、收益计算器
  // --------------------------------------------------

  function renderCalculatorPanel() {
    const panel = $("#panel-calculator");
    if (!panel) return;

    const stationOptions = appData.stations.map(station => `
      <option value="${escapeHTML(station.id)}">
        ${escapeHTML(station.name)}
      </option>
    `).join("");

    const productOptions = appData.products.map(product => `
      <option value="${escapeHTML(product.id)}">
        ${escapeHTML(product.name)}
      </option>
    `).join("");

    panel.innerHTML = `
      <section class="calculator-detail">
        <h2>单笔交易收益计算</h2>

        <p class="trade-muted">
          计算公式：可购买数量 ×（卖出价 − 买入价）。
          可购买数量 = 向下取整（仓库容量 ÷ 单件重量）。
        </p>

        <div class="trade-field-grid">
          <label>
            买入站点
            <select id="calcBuyStation">${stationOptions}</select>
          </label>

          <label>
            卖出站点
            <select id="calcSellStation">${stationOptions}</select>
          </label>

          <label>
            商品
            <select id="calcProduct">${productOptions}</select>
          </label>

          <label>
            仓库容量
            <input id="calcCapacity" type="number" min="0" step="any"
			  value="${appData.settings?.warehouseCapacity ?? 100}"
          </label>

          <label>
            买入价（单件）
            <input id="calcBuyPrice" type="number" min="0" step="any"
              placeholder="输入买入价">
          </label>

          <label>
            卖出价（单件）
            <input id="calcSellPrice" type="number" min="0" step="any"
              placeholder="输入卖出价">
          </label>

          <label>
            单件重量
            <input id="calcWeight" type="number" min="0" step="any"
              placeholder="输入商品重量">
          </label>
        </div>

        <div class="trade-actions">
          <button type="button" id="loadPricesButton">读取站点价格</button>
          <button type="button" id="calculateProfitButton">计算收益</button>
        </div>

        <div id="calculatorResult" class="calculator-result" aria-live="polite">
          <p>请填写交易参数后计算。</p>
        </div>
      </section>
    `;

    $("#calcBuyStation", panel).value = selectedStationId || "";
    $("#calcSellStation", panel).value =
      appData.stations.find(s => s.id !== selectedStationId)?.id ||
      selectedStationId ||
      "";

    $("#loadPricesButton", panel).addEventListener("click", loadCalculatorPrices);
    $("#calculateProfitButton", panel).addEventListener("click", calculateProfit);

    $("#calcProduct", panel).addEventListener("change", loadCalculatorPrices);
    $("#calcBuyStation", panel).addEventListener("change", loadCalculatorPrices);
    $("#calcSellStation", panel).addEventListener("change", loadCalculatorPrices);
  }

  function loadCalculatorPrices() {
    const product = getProduct($("#calcProduct")?.value);
    const buyStationId = $("#calcBuyStation")?.value;
    const sellStationId = $("#calcSellStation")?.value;

    if (!product) return;

    const buyPrice = getPrice(product, buyStationId).buy;
    const sellPrice = getPrice(product, sellStationId).sell;

    $("#calcBuyPrice").value = buyPrice ?? "";
    $("#calcSellPrice").value = sellPrice ?? "";
    $("#calcWeight").value = product.weight ?? "";

    if (buyPrice === null || sellPrice === null || product.weight === null) {
      $("#calculatorResult").innerHTML = `
        <p>本站点或商品价格尚未完整录入。请先补充数据，或手动填写本次计算参数。</p>
      `;
    }
  }

  function calculateProfit() {
    const product = getProduct($("#calcProduct")?.value);

    const capacity = parseNumber($("#calcCapacity")?.value);
    const buyPrice = parseNumber($("#calcBuyPrice")?.value);
    const sellPrice = parseNumber($("#calcSellPrice")?.value);
    const weight = parseNumber($("#calcWeight")?.value);

    const resultElement = $("#calculatorResult");

    if (
      capacity === null || buyPrice === null ||
      sellPrice === null || weight === null
    ) {
      resultElement.innerHTML = "<p>请填写完整的仓库容量、买入价、卖出价和商品重量。</p>";
      return;
    }

    if (
      capacity <= 0 || weight <= 0 ||
      buyPrice < 0 || sellPrice < 0
    ) {
      resultElement.innerHTML = "<p>仓库容量和商品重量必须大于 0，价格不能为负数。</p>";
      return;
    }

    const quantity = Math.floor(capacity / weight);
    const totalCost = quantity * buyPrice;
    const totalRevenue = quantity * sellPrice;
    const profit = totalRevenue - totalCost;

    calculatorResult = {
      productId: product?.id || null,
      quantity,
      totalCost,
      totalRevenue,
      profit
    };

    resultElement.innerHTML = `
      <h3>计算结果</h3>
      <p>可购买数量：<strong>${formatNumber(quantity)}</strong></p>
      <p>买入总成本：${formatNumber(totalCost)} ${escapeHTML(appData.settings.currencyName)}</p>
      <p>卖出总收入：${formatNumber(totalRevenue)} ${escapeHTML(appData.settings.currencyName)}</p>
      <p>预计单笔收益：<strong>${formatNumber(profit)} ${escapeHTML(appData.settings.currencyName)}</strong></p>
      <p class="trade-muted">本结果未计入额外费用、库存限制或其他游戏机制。</p>
    `;

    const capacityInput = $("#calcCapacity");
    const newCapacity = parseNumber(capacityInput?.value);

    if (newCapacity !== null && newCapacity > 0) {
      appData.settings.warehouseCapacity = newCapacity;
      markChanged();
    }
  }

  // --------------------------------------------------
  // 五、路线推荐占位面板
  // --------------------------------------------------

  function renderRoutesPanel() {
    const panel = $("#panel-routes");
    if (!panel) return;

    panel.innerHTML = `
      <section class="route-detail">
        <h2>推荐路线</h2>
        <p>
          路线推荐模块将在道路数据完善后启用。
        </p>
        <p>
          当前道路连接数量：
          <strong>${appData.roads.connections.length}</strong>
        </p>
        <p class="trade-muted">
          为避免生成穿越无道路区域的虚假路线，当前不会推荐路线。
          下一阶段会根据真实道路连接、各站商品价格、仓库容量及回到起点的要求计算路线总收益。
        </p>
      </section>
    `;
  }

  // --------------------------------------------------
  // 六、导入 / 导出 JSON
  // --------------------------------------------------

  function addImportExportControls() {
    const buttons = $$("button");
    const exportButton = buttons.find(button =>
      /导出/.test(button.textContent)
    );
    const importButton = buttons.find(button =>
      /导入/.test(button.textContent)
    );

    if (exportButton && !exportButton.dataset.tradeBound) {
      exportButton.dataset.tradeBound = "true";

      exportButton.addEventListener("click", function () {
        try {
          window.TradeStorage.exportJSON(appData);
        } catch (error) {
          alert("导出失败：" + error.message);
        }
      });
    }

    if (importButton && !importButton.dataset.tradeBound) {
      importButton.dataset.tradeBound = "true";

      importButton.addEventListener("click", function () {
        let fileInput = $("#tradeImportFile");

        if (!fileInput) {
          fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.accept = ".json,application/json";
          fileInput.id = "tradeImportFile";
          fileInput.hidden = true;
          document.body.appendChild(fileInput);

          fileInput.addEventListener("change", async function () {
            const file = fileInput.files?.[0];
            if (!file) return;

            try {
              const imported = await window.TradeStorage.importJSON(file);
              appData = imported;

              if (!getStation(selectedStationId)) {
                selectedStationId = appData.stations[0]?.id || null;
              }

              renderMap();
              switchTab(currentTab);
              setSaveStatus("已导入并保存");
              alert("JSON 数据导入成功。");
            } catch (error) {
              alert(error.message || "导入失败。");
            } finally {
              fileInput.value = "";
            }
          });
        }

        fileInput.click();
      });
    }
  }

  // --------------------------------------------------
  // 七、页面初始化
  // --------------------------------------------------

  function initTabs() {
    $$("[data-tab]").forEach(button => {
      button.addEventListener("click", function () {
        switchTab(button.dataset.tab);
      });
    });
  }

  function init() {
    initTabs();
    addImportExportControls();

    renderMap();
    switchTab(currentTab);

    setSaveStatus("本地数据已加载");

    console.info("商路收益计算器初始化成功。");
    console.info("站点数量：", appData.stations.length);
    console.info("道路数量：", appData.roads.connections.length);
    console.info("商品数量：", appData.products.length);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
