/**
 * Enterprise SCM Dashboard — Google Apps Script backend.
 *
 * Deploy this as a Web App bound to a Google Sheet with 4 tabs:
 *
 *   Users       | id | username | passwordHash | role | status |
 *   SKUs        | name | category | po | safety | daily_demand | tipe_stock | target_simpan |
 *   WeeklyData  | sku_name | week | forecast | realization |
 *   Batches     | sku_name | batch_id | date | qty_in | qty_used | sisa |
 *
 * Setup:
 *   1. Create a new Google Sheet.
 *   2. Extensions > Apps Script, paste this whole file in as Code.gs.
 *   3. Reload the Sheet, use the new "SCM Admin" menu > "Setup Sheets" to create
 *      the 4 tabs with headers automatically.
 *   4. Project Settings > Script Properties: add API_TOKEN = <a random secret string>.
 *      Put the same value in your Next.js app's APPS_SCRIPT_TOKEN env var.
 *   5. Use "SCM Admin" menu > "Create / Reset User" to add your first Admin user
 *      (this hashes the password with SHA-256 and appends a row to Users for you).
 *   6. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *   7. Copy the /exec URL into your Next.js app's APPS_SCRIPT_URL env var.
 */

var SHEET_NAMES = { USERS: "Users", SKUS: "SKUs", WEEKLY: "WeeklyData", BATCHES: "Batches" };

var SHEET_HEADERS = {
  Users: ["id", "username", "passwordHash", "role", "status"],
  SKUs: ["name", "category", "po", "safety", "daily_demand", "tipe_stock", "target_simpan"],
  WeeklyData: ["sku_name", "week", "forecast", "realization"],
  Batches: ["sku_name", "batch_id", "date", "qty_in", "qty_used", "sisa"],
};

// ---------------------------------------------------------------------------
// HTTP entry points
// ---------------------------------------------------------------------------

function doGet() {
  return ContentService.createTextOutput("SCM Apps Script API is running.");
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonOut({ ok: false, error: "Invalid JSON body" });
    }

    var apiToken = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
    if (!apiToken || body.token !== apiToken) {
      return jsonOut({ ok: false, error: "Unauthorized" });
    }

    var handlers = {
      login: handleLogin,
      getAll: handleGetAll,
      listUsers: handleListUsers,
      createUser: handleCreateUser,
      deleteUser: handleDeleteUser,
      upsertSku: handleUpsertSku,
      deleteSku: handleDeleteSku,
      upsertWeekly: handleUpsertWeekly,
      clearWeekly: handleClearWeekly,
      addBatch: handleAddBatch,
      deleteBatch: handleDeleteBatch,
      bulkImportWeekly: handleBulkImportWeekly,
      bulkImportStock: handleBulkImportStock,
      bulkImportAging: handleBulkImportAging,
    };

    var fn = handlers[body.action];
    if (!fn) return jsonOut({ ok: false, error: "Unknown action: " + body.action });

    return jsonOut(fn(body));
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------------

function sheet(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Sheet tab "' + name + '" not found. Run "SCM Admin > Setup Sheets" first.');
  return sh;
}

function rowsToObjects(sh) {
  var values = sh.getDataRange().getValues();
  var headers = values.shift();
  return values
    .filter(function (row) {
      return row.join("") !== ""; // skip fully blank rows
    })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) {
        obj[h] = row[i];
      });
      return obj;
    });
}

function findRowIndexByMatch(sh, matchFn) {
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    headers.forEach(function (h, j) {
      obj[h] = values[i][j];
    });
    if (matchFn(obj)) return i + 1; // 1-based sheet row number
  }
  return -1;
}

function appendRowObject(sh, headers, obj) {
  var row = headers.map(function (h) {
    return obj[h] !== undefined ? obj[h] : "";
  });
  sh.appendRow(row);
}

function updateRowObject(sh, rowNumber, headers, obj) {
  var row = headers.map(function (h) {
    return obj[h] !== undefined ? obj[h] : "";
  });
  sh.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
}

function fmtDate(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone() || "UTC", "yyyy-MM-dd");
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function handleLogin(body) {
  var users = rowsToObjects(sheet(SHEET_NAMES.USERS));
  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].username) === String(body.username) && String(users[i].passwordHash) === String(body.passwordHash)) {
      user = users[i];
      break;
    }
  }
  if (!user) return { ok: false, error: "Invalid username or password." };
  if (user.status !== "Active") return { ok: false, error: "Account is inactive. Contact administrator." };
  return { ok: true, data: { id: String(user.id), username: user.username, role: user.role } };
}

// ---------------------------------------------------------------------------
// Aggregate read
// ---------------------------------------------------------------------------

function handleGetAll(body) {
  var data = {
    skus: rowsToObjects(sheet(SHEET_NAMES.SKUS)),
    weekly: rowsToObjects(sheet(SHEET_NAMES.WEEKLY)),
    batches: rowsToObjects(sheet(SHEET_NAMES.BATCHES)),
  };
  if (body.includeUsers) {
    data.users = rowsToObjects(sheet(SHEET_NAMES.USERS)).map(function (u) {
      return { id: String(u.id), username: u.username, role: u.role, status: u.status };
    });
  }
  return { ok: true, data: data };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function handleListUsers() {
  var users = rowsToObjects(sheet(SHEET_NAMES.USERS)).map(function (u) {
    return { id: String(u.id), username: u.username, role: u.role, status: u.status };
  });
  return { ok: true, data: users };
}

function handleCreateUser(body) {
  var sh = sheet(SHEET_NAMES.USERS);
  var existingIdx = findRowIndexByMatch(sh, function (u) {
    return String(u.username) === String(body.username);
  });
  if (existingIdx > -1) return { ok: false, error: "Username already exists." };

  var id = Math.floor(Math.random() * 9000) + 1000;
  appendRowObject(sh, SHEET_HEADERS.Users, {
    id: id,
    username: body.username,
    passwordHash: body.passwordHash,
    role: body.role || "User",
    status: "Active",
  });
  return { ok: true, data: { id: String(id), username: body.username, role: body.role || "User", status: "Active" } };
}

function handleDeleteUser(body) {
  var sh = sheet(SHEET_NAMES.USERS);
  var rowIdx = findRowIndexByMatch(sh, function (u) {
    return String(u.id) === String(body.id);
  });
  if (rowIdx === -1) return { ok: false, error: "User not found." };
  sh.deleteRow(rowIdx);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// SKUs (Stock Health params)
// ---------------------------------------------------------------------------

function upsertSkuRow(skuName, patch, createDefaults) {
  var sh = sheet(SHEET_NAMES.SKUS);
  var rowIdx = findRowIndexByMatch(sh, function (s) {
    return String(s.name) === String(skuName);
  });
  if (rowIdx === -1) {
    var obj = Object.assign(
      {
        name: skuName,
        category: "UNCATEGORIZED",
        po: 0,
        safety: 0,
        daily_demand: 1,
        tipe_stock: "Reguler",
        target_simpan: 30,
      },
      createDefaults || {},
      patch
    );
    appendRowObject(sh, SHEET_HEADERS.SKUs, obj);
    return obj;
  } else {
    var values = sh.getRange(rowIdx, 1, 1, SHEET_HEADERS.SKUs.length).getValues()[0];
    var current = {};
    SHEET_HEADERS.SKUs.forEach(function (h, i) {
      current[h] = values[i];
    });
    var merged = Object.assign(current, patch);
    updateRowObject(sh, rowIdx, SHEET_HEADERS.SKUs, merged);
    return merged;
  }
}

function handleUpsertSku(body) {
  var patch = {
    category: body.category,
    po: body.po,
    safety: body.safety,
    daily_demand: body.daily_demand,
    tipe_stock: body.tipe_stock,
    target_simpan: body.target_simpan,
  };
  var result = upsertSkuRow(body.name, patch);
  return { ok: true, data: result };
}

function handleDeleteSku(body) {
  var name = body.name;

  var skuSh = sheet(SHEET_NAMES.SKUS);
  var skuRow = findRowIndexByMatch(skuSh, function (s) {
    return String(s.name) === String(name);
  });
  if (skuRow > -1) skuSh.deleteRow(skuRow);

  // Cascade: remove matching WeeklyData rows (iterate bottom-up so deletes don't shift indices)
  var weeklySh = sheet(SHEET_NAMES.WEEKLY);
  var weeklyValues = weeklySh.getDataRange().getValues();
  for (var i = weeklyValues.length - 1; i >= 1; i--) {
    if (String(weeklyValues[i][0]) === String(name)) weeklySh.deleteRow(i + 1);
  }

  // Cascade: remove matching Batches rows
  var batchSh = sheet(SHEET_NAMES.BATCHES);
  var batchValues = batchSh.getDataRange().getValues();
  for (var j = batchValues.length - 1; j >= 1; j--) {
    if (String(batchValues[j][0]) === String(name)) batchSh.deleteRow(j + 1);
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Weekly forecast / realization
// ---------------------------------------------------------------------------

function upsertWeeklyRow(skuName, week, patch) {
  var sh = sheet(SHEET_NAMES.WEEKLY);
  var rowIdx = findRowIndexByMatch(sh, function (w) {
    return String(w.sku_name) === String(skuName) && Number(w.week) === Number(week);
  });
  if (rowIdx === -1) {
    var obj = Object.assign({ sku_name: skuName, week: week, forecast: 0, realization: 0 }, patch);
    appendRowObject(sh, SHEET_HEADERS.WeeklyData, obj);
  } else {
    var values = sh.getRange(rowIdx, 1, 1, SHEET_HEADERS.WeeklyData.length).getValues()[0];
    var current = {};
    SHEET_HEADERS.WeeklyData.forEach(function (h, i) {
      current[h] = values[i];
    });
    updateRowObject(sh, rowIdx, SHEET_HEADERS.WeeklyData, Object.assign(current, patch));
  }
}

function handleUpsertWeekly(body) {
  // Ensure the SKU master row exists (mirrors original "create SKU on first sight" import behavior).
  upsertSkuRow(body.skuName, {}, { category: body.category || "UNCATEGORIZED" });
  upsertWeeklyRow(body.skuName, body.week, { forecast: body.forecast, realization: body.realization });
  return { ok: true };
}

function handleClearWeekly(body) {
  upsertWeeklyRow(body.skuName, body.week, { forecast: 0, realization: 0 });
  return { ok: true };
}

function handleBulkImportWeekly(body) {
  var rows = body.rows || [];
  var successCount = 0;
  rows.forEach(function (r) {
    upsertSkuRow(r.skuName, {}, { category: r.category || "UNCATEGORIZED" });
    upsertWeeklyRow(r.skuName, r.week, { forecast: r.forecast, realization: r.realization });
    successCount++;
  });
  return { ok: true, data: { successCount: successCount } };
}

// ---------------------------------------------------------------------------
// Stock Health bulk import (also seeds an initial batch if the SKU has none)
// ---------------------------------------------------------------------------

function handleBulkImportStock(body) {
  var rows = body.rows || [];
  var successCount = 0;
  var batchSh = sheet(SHEET_NAMES.BATCHES);

  rows.forEach(function (r) {
    var existed =
      findRowIndexByMatch(sheet(SHEET_NAMES.SKUS), function (s) {
        return String(s.name) === String(r.skuName);
      }) > -1;

    upsertSkuRow(r.skuName, {
      category: r.category || undefined,
      daily_demand: r.dailyDemand,
      po: r.po,
      safety: r.safety,
    });

    // If the SKU currently has no batch rows and an initial stock qty was given,
    // seed one batch — matches the original's "stock" field being derived-only.
    var hasBatches =
      findRowIndexByMatch(batchSh, function (b) {
        return String(b.sku_name) === String(r.skuName);
      }) > -1;
    if (!hasBatches && r.stock > 0) {
      appendRowObject(batchSh, SHEET_HEADERS.Batches, {
        sku_name: r.skuName,
        batch_id: "B_INIT_" + new Date().getTime() + "_" + successCount,
        date: fmtDate(new Date()),
        qty_in: r.stock,
        qty_used: 0,
        sisa: r.stock,
      });
    }
    successCount++;
  });

  return { ok: true, data: { successCount: successCount } };
}

// ---------------------------------------------------------------------------
// Batches (FIFO / Aging)
// ---------------------------------------------------------------------------

function handleAddBatch(body) {
  var sh = sheet(SHEET_NAMES.BATCHES);
  var batchId = "B_" + new Date().getTime();
  var sisa = Number(body.qtyIn) - Number(body.qtyUsed);
  appendRowObject(sh, SHEET_HEADERS.Batches, {
    sku_name: body.skuName,
    batch_id: batchId,
    date: body.date,
    qty_in: body.qtyIn,
    qty_used: body.qtyUsed,
    sisa: sisa,
  });
  return { ok: true, data: { batchId: batchId, sisa: sisa } };
}

function handleDeleteBatch(body) {
  var sh = sheet(SHEET_NAMES.BATCHES);
  var rowIdx = findRowIndexByMatch(sh, function (b) {
    return String(b.sku_name) === String(body.skuName) && String(b.batch_id) === String(body.batchId);
  });
  if (rowIdx === -1) return { ok: false, error: "Batch not found." };
  sh.deleteRow(rowIdx);
  return { ok: true };
}

function handleBulkImportAging(body) {
  var rows = body.rows || [];
  var batchSh = sheet(SHEET_NAMES.BATCHES);
  var resetSkus = {}; // clear a SKU's existing batches once per import call, on first row seen
  var successCount = 0;

  rows.forEach(function (r, idx) {
    var existed =
      findRowIndexByMatch(sheet(SHEET_NAMES.SKUS), function (s) {
        return String(s.name) === String(r.skuName);
      }) > -1;

    if (!existed) {
      upsertSkuRow(r.skuName, {
        category: r.category || "UNCATEGORIZED",
        tipe_stock: r.tipeStock,
        target_simpan: r.targetSimpan,
      });
    } else {
      upsertSkuRow(r.skuName, { tipe_stock: r.tipeStock, target_simpan: r.targetSimpan });
    }

    if (!resetSkus[r.skuName]) {
      var values = batchSh.getDataRange().getValues();
      for (var i = values.length - 1; i >= 1; i--) {
        if (String(values[i][0]) === String(r.skuName)) batchSh.deleteRow(i + 1);
      }
      resetSkus[r.skuName] = true;
    }

    if (r.incomingDate && r.qtyIn > 0) {
      appendRowObject(batchSh, SHEET_HEADERS.Batches, {
        sku_name: r.skuName,
        batch_id: "B_" + new Date().getTime() + "_" + idx,
        date: r.incomingDate,
        qty_in: r.qtyIn,
        qty_used: r.qtyUsed,
        sisa: r.sisa,
      });
    }
    successCount++;
  });

  return { ok: true, data: { successCount: successCount } };
}

// ---------------------------------------------------------------------------
// One-time setup helpers (run manually from the Apps Script / Sheet UI)
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("SCM Admin")
    .addItem("Setup Sheets", "setupSheets")
    .addItem("Create / Reset User", "promptCreateUser")
    .addToUi();
}

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    var headers = SHEET_HEADERS[name];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  });
  SpreadsheetApp.getUi().alert("Sheets created/verified: " + Object.keys(SHEET_HEADERS).join(", "));
}

function computeSha256Hex(input) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  var hex = "";
  for (var i = 0; i < rawHash.length; i++) {
    var b = rawHash[i];
    if (b < 0) b += 256;
    var h = b.toString(16);
    if (h.length === 1) h = "0" + h;
    hex += h;
  }
  return hex;
}

// Menu-driven helper so an admin can create (or reset the password of) a user
// directly from the Sheet UI, without needing the Next.js app to be running yet.
function promptCreateUser() {
  var ui = SpreadsheetApp.getUi();
  var usernameResp = ui.prompt("Create / Reset User", "Username:", ui.ButtonSet.OK_CANCEL);
  if (usernameResp.getSelectedButton() !== ui.Button.OK) return;
  var username = usernameResp.getResponseText().trim();
  if (!username) return;

  var passResp = ui.prompt("Create / Reset User", "Password for " + username + ":", ui.ButtonSet.OK_CANCEL);
  if (passResp.getSelectedButton() !== ui.Button.OK) return;
  var password = passResp.getResponseText();
  if (!password) return;

  var roleResp = ui.prompt("Create / Reset User", 'Role — type "Admin" or "User":', ui.ButtonSet.OK_CANCEL);
  if (roleResp.getSelectedButton() !== ui.Button.OK) return;
  var role = roleResp.getResponseText().trim() === "Admin" ? "Admin" : "User";

  var passwordHash = computeSha256Hex(password);
  var sh = sheet(SHEET_NAMES.USERS);
  var rowIdx = findRowIndexByMatch(sh, function (u) {
    return String(u.username) === username;
  });

  if (rowIdx > -1) {
    var values = sh.getRange(rowIdx, 1, 1, SHEET_HEADERS.Users.length).getValues()[0];
    var current = {};
    SHEET_HEADERS.Users.forEach(function (h, i) {
      current[h] = values[i];
    });
    updateRowObject(sh, rowIdx, SHEET_HEADERS.Users, Object.assign(current, { passwordHash: passwordHash, role: role, status: "Active" }));
    ui.alert("Password/role updated for " + username);
  } else {
    var id = Math.floor(Math.random() * 9000) + 1000;
    appendRowObject(sh, SHEET_HEADERS.Users, { id: id, username: username, passwordHash: passwordHash, role: role, status: "Active" });
    ui.alert("User " + username + " created with role " + role);
  }
}
