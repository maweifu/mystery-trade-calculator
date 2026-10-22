
/**
 * 本地数据存储模块
 * 依赖：data.js
 */

(function () {
  "use strict";

  const STORAGE_KEY = "mystery_trade_calculator_data";
  const SAVE_DELAY = 500;

  let saveTimer = null;

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function validateData(data) {
    if (!data || typeof data !== "object") {
      throw new Error("数据格式错误：内容不是有效对象。");
    }

    if (!Array.isArray(data.stations) ||
        !Array.isArray(data.products) ||
        !Array.isArray(data.regions) ||
        !data.roads ||
        !Array.isArray(data.roads.connections)) {
      throw new Error("数据格式错误：缺少站点、商品、区域或道路数据。");
    }

    const stationIds = new Set();

    for (const station of data.stations) {
      if (!station.id || !station.name || !station.region) {
        throw new Error("数据格式错误：存在缺少 ID、名称或区域的站点。");
      }

      if (stationIds.has(station.id)) {
        throw new Error("数据格式错误：站点 ID 重复：" + station.id);
      }

      stationIds.add(station.id);
    }

    for (const road of data.roads.connections) {
      if (!stationIds.has(road.from) || !stationIds.has(road.to)) {
        throw new Error("数据格式错误：道路连接了不存在的站点。");
      }
    }

    return true;
  }

  function load() {
    const defaults = cloneData(window.TradeDefaultData);

    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return defaults;
      }

      const savedData = JSON.parse(raw);
      validateData(savedData);

      // 版本不同则回退到默认数据，避免不兼容的旧结构影响运行。
      if (savedData.schemaVersion !== defaults.schemaVersion) {
        console.warn("本地数据版本不匹配，已加载默认数据。");
        return defaults;
      }

      return savedData;
    } catch (error) {
      console.error("读取本地数据失败：", error);
      return defaults;
    }
  }

  function save(data) {
    validateData(data);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("保存本地数据失败：", error);
      throw new Error(
        "保存失败。请检查浏览器存储空间或隐私设置，并及时导出备份。"
      );
    }
  }

  function scheduleSave(data) {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
    }

    // 立即复制快照，避免定时器执行前数据对象继续变化。
    const snapshot = cloneData(data);

    saveTimer = setTimeout(function () {
      saveTimer = null;

      try {
        save(snapshot);
        window.dispatchEvent(
          new CustomEvent("trade-data-saved")
        );
      } catch (error) {
        window.dispatchEvent(
          new CustomEvent("trade-data-save-error", {
            detail: { message: error.message }
          })
        );
      }
    }, SAVE_DELAY);
  }

  function exportJSON(data) {
    validateData(data);

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], {
      type: "application/json;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = "诡秘之主商路数据_" + date + ".json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    if (!file) {
      return Promise.reject(new Error("没有选择 JSON 文件。"));
    }

    return file.text().then(function (text) {
      let data;

      try {
        data = JSON.parse(text);
      } catch (error) {
        throw new Error("导入失败：文件不是有效的 JSON。");
      }

      validateData(data);

      if (data.schemaVersion !== window.TradeDefaultData.schemaVersion) {
        throw new Error("导入失败：数据版本不兼容。");
      }

      // 校验通过后再保存，避免无效文件破坏现有数据。
      save(data);

      return cloneData(data);
    });
  }

  function reset() {
    const defaults = cloneData(window.TradeDefaultData);
    save(defaults);
    return defaults;
  }

  window.TradeStorage = {
    load,
    save,
    scheduleSave,
    exportJSON,
    importJSON,
    reset,
    validateData
  };
})();
