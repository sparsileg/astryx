// src-tauri/src/commands/targets.rs
// The target database is large (thousands of records). get_all_targets returns
// the full array; save_targets_bulk is used for initial load and updates.

use std::sync::Arc;
use tauri::State;
use crate::AstryxState;

#[tauri::command]
pub fn get_all_targets(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().expect("db lock poisoned");
    let mut stmt = db.prepare(
        "SELECT object, catalogue, type, ra, dec, mag, subr,
                size_max, size_min, common, other, constellation,
                best_month, peak_altitude, visibility_start, visibility_end
         FROM targets"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        let best_month: Option<String> = row.get(12)?;
        let peak_altitude: Option<String> = row.get(13)?;
        let visibility_start: Option<String> = row.get(14)?;
        let visibility_end: Option<String> = row.get(15)?;

        Ok(serde_json::json!({
            "object":        row.get::<_, String>(0)?,
            "catalogue":     row.get::<_, String>(1)?,
            "type":          row.get::<_, String>(2)?,
            "ra":            row.get::<_, f64>(3)?,
            "dec":           row.get::<_, f64>(4)?,
            "mag":           row.get::<_, Option<String>>(5)?,
            "subr":          row.get::<_, Option<String>>(6)?,
            "size_max":      row.get::<_, Option<String>>(7)?,
            "size_min":      row.get::<_, Option<String>>(8)?,
            "common":        row.get::<_, Option<String>>(9)?,
            "other":         row.get::<_, Option<String>>(10)?,
            "constellation": row.get::<_, String>(11)?,
            "bestMonth":     best_month.as_deref()
                                 .and_then(|s| serde_json::from_str(s).ok())
                                 .unwrap_or(serde_json::Value::Null),
            "peakAltitude":  peak_altitude.as_deref()
                                 .and_then(|s| serde_json::from_str(s).ok())
                                 .unwrap_or(serde_json::Value::Null),
            "visibilityStart": visibility_start.as_deref()
                                 .and_then(|s| serde_json::from_str(s).ok())
                                 .unwrap_or(serde_json::Value::Null),
            "visibilityEnd": visibility_end.as_deref()
                                 .and_then(|s| serde_json::from_str(s).ok())
                                 .unwrap_or(serde_json::Value::Null),
        }))
    })
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(rows)
}

/// Save a single target (insert or replace by object).
/// Used when updating best months data for individual targets.
#[tauri::command]
pub fn save_target(target: serde_json::Value, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    upsert_target(&db, &target)
}

/// Bulk save targets. Clears the table first then inserts all records.
/// Used for initial target database load and updates.
#[tauri::command]
pub fn save_targets_bulk(targets: Vec<serde_json::Value>, state: State<Arc<AstryxState>>) -> Result<(), String> {
    let mut db = state.db.lock().expect("db lock poisoned");
    let tx = db.transaction().map_err(|e| e.to_string())?;

    for target in &targets {
        upsert_target_tx(&tx, target)?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete all targets. Used by clear-all-targets admin operation.
#[tauri::command]
pub fn delete_all_targets(state: State<Arc<AstryxState>>) -> Result<(), String> {
    let db = state.db.lock().expect("db lock poisoned");
    db.execute("DELETE FROM targets", [])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn upsert_target(conn: &rusqlite::Connection, target: &serde_json::Value) -> Result<(), String> {
    conn.execute(
        "INSERT INTO targets
             (object, catalogue, type, ra, dec, mag, subr,
              size_max, size_min, common, other, constellation,
              best_month, peak_altitude, visibility_start, visibility_end)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
         ON CONFLICT(object) DO UPDATE SET
             catalogue        = excluded.catalogue,
             type             = excluded.type,
             ra               = excluded.ra,
             dec              = excluded.dec,
             mag              = excluded.mag,
             subr             = excluded.subr,
             size_max         = excluded.size_max,
             size_min         = excluded.size_min,
             common           = excluded.common,
             other            = excluded.other,
             constellation    = excluded.constellation,
             best_month       = excluded.best_month,
             peak_altitude    = excluded.peak_altitude,
             visibility_start = excluded.visibility_start,
             visibility_end   = excluded.visibility_end",
        rusqlite::params![
            target["object"].as_str().ok_or("missing object")?,
            target["catalogue"].as_str().unwrap_or(""),
            target["type"].as_str().unwrap_or(""),
            target["ra"].as_f64().ok_or("missing ra")?,
            target["dec"].as_f64().ok_or("missing dec")?,
            target["mag"].as_str(),
            target["subr"].as_str(),
            target["size_max"].as_str(),
            target["size_min"].as_str(),
            target["common"].as_str(),
            target["other"].as_str(),
            target["constellation"].as_str().unwrap_or(""),
            target.get("bestMonth").and_then(|v| if v.is_null() { None } else { serde_json::to_string(v).ok() }),
            target.get("peakAltitude").and_then(|v| if v.is_null() { None } else { serde_json::to_string(v).ok() }),
            target.get("visibilityStart").and_then(|v| if v.is_null() { None } else { serde_json::to_string(v).ok() }),
            target.get("visibilityEnd").and_then(|v| if v.is_null() { None } else { serde_json::to_string(v).ok() }),
        ],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

fn upsert_target_tx(tx: &rusqlite::Transaction, target: &serde_json::Value) -> Result<(), String> {
    tx.execute(
        "INSERT INTO targets
             (object, catalogue, type, ra, dec, mag, subr,
              size_max, size_min, common, other, constellation,
              best_month, peak_altitude, visibility_start, visibility_end)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
         ON CONFLICT(object) DO UPDATE SET
             catalogue        = excluded.catalogue,
             type             = excluded.type,
             ra               = excluded.ra,
             dec              = excluded.dec,
             mag              = excluded.mag,
             subr             = excluded.subr,
             size_max         = excluded.size_max,
             size_min         = excluded.size_min,
             common           = excluded.common,
             other            = excluded.other,
             constellation    = excluded.constellation,
             best_month       = excluded.best_month,
             peak_altitude    = excluded.peak_altitude,
             visibility_start = excluded.visibility_start,
             visibility_end   = excluded.visibility_end",
        rusqlite::params![
            target["object"].as_str().ok_or("missing object")?,
            target["catalogue"].as_str().unwrap_or(""),
            target["type"].as_str().unwrap_or(""),
            target["ra"].as_f64().ok_or("missing ra")?,
            target["dec"].as_f64().ok_or("missing dec")?,
            target["mag"].as_str(),
            target["subr"].as_str(),
            target["size_max"].as_str(),
            target["size_min"].as_str(),
            target["common"].as_str(),
            target["other"].as_str(),
            target["constellation"].as_str().unwrap_or(""),
            target.get("bestMonth").and_then(|v| if v.is_null() { None } else { serde_json::to_string(v).ok() }),
            target.get("peakAltitude").and_then(|v| if v.is_null() { None } else { serde_json::to_string(v).ok() }),
            target.get("visibilityStart").and_then(|v| if v.is_null() { None } else { serde_json::to_string(v).ok() }),
            target.get("visibilityEnd").and_then(|v| if v.is_null() { None } else { serde_json::to_string(v).ok() }),
        ],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

// ----------------------------------------------------------------------
