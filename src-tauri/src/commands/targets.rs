// src-tauri/src/commands/targets.rs
// The target database is large (thousands of records). get_all_targets returns
// the full array; save_targets_bulk is used for initial load and updates.

use crate::AstryxState;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_all_targets(state: State<Arc<AstryxState>>) -> Result<Vec<serde_json::Value>, String> {
    sql::get_all_targets(&*state.conn()?)
}

/// Save a single target (insert or replace by object).
/// Used when updating best months data for individual targets.
#[tauri::command]
pub fn save_target(
    target: serde_json::Value,
    state: State<Arc<AstryxState>>,
) -> Result<(), String> {
    sql::upsert_target(&*state.conn()?, &target)
}

/// Bulk save targets: insert or update each one, in a single transaction.
/// Used for initial target database load and updates.
#[tauri::command]
pub fn save_targets_bulk(
    targets: Vec<serde_json::Value>,
    state: State<Arc<AstryxState>>,
) -> Result<(), String> {
    sql::save_targets_bulk(&mut *state.conn()?, &targets)
}

/// Delete all targets. Used by clear-all-targets admin operation.
#[tauri::command]
pub fn delete_all_targets(state: State<Arc<AstryxState>>) -> Result<(), String> {
    sql::delete_all_targets(&*state.conn()?)
}

// ── Database ──────────────────────────────────────────────────────────────────

pub(crate) mod sql {
    use rusqlite::Connection;

    pub fn get_all_targets(conn: &Connection) -> Result<Vec<serde_json::Value>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT object, catalogue, type, ra, dec, mag, subr,
                    size_max, size_min, common, other, constellation,
                    best_month, peak_altitude, visibility_start, visibility_end
             FROM targets",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
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

    pub fn save_targets_bulk(
        conn: &mut Connection,
        targets: &[serde_json::Value],
    ) -> Result<(), String> {
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        for target in targets {
            upsert_target(&tx, target)?;
        }

        tx.commit().map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_all_targets(conn: &Connection) -> Result<(), String> {
        conn.execute("DELETE FROM targets", [])
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    /// Insert a target, or update it if its object designation exists.
    /// Also takes a Transaction, which derefs to Connection.
    pub fn upsert_target(conn: &Connection, target: &serde_json::Value) -> Result<(), String> {
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
                target.get("bestMonth").and_then(|v| if v.is_null() {
                    None
                } else {
                    serde_json::to_string(v).ok()
                }),
                target.get("peakAltitude").and_then(|v| if v.is_null() {
                    None
                } else {
                    serde_json::to_string(v).ok()
                }),
                target.get("visibilityStart").and_then(|v| if v.is_null() {
                    None
                } else {
                    serde_json::to_string(v).ok()
                }),
                target.get("visibilityEnd").and_then(|v| if v.is_null() {
                    None
                } else {
                    serde_json::to_string(v).ok()
                }),
            ],
        )
        .map(|_| ())
        .map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::sql::*;
    use crate::db::test_conn;
    use serde_json::json;

    /// A target as JS holds it after Best Months has run for two locations.
    fn m42() -> serde_json::Value {
        json!({
            "object": "M 42", "catalogue": "M", "type": "Neb", "ra": 5.588, "dec": -5.391,
            "mag": "4", "subr": "13.5", "size_max": "85", "size_min": "60",
            "common": "Orion Nebula", "other": "NGC 1976", "constellation": "Ori",
            "bestMonth":       { "Home": 1, "Dark Site": 12 },
            "peakAltitude":    { "Home": 45.3, "Dark Site": 0 },
            "visibilityStart": { "Home": "2026-10-01" },
            "visibilityEnd":   { "Home": "2027-03-15" },
        })
    }

    /// A target with only the fields every CSV row has.
    fn sparse() -> serde_json::Value {
        json!({
            "object": "NGC 7000", "catalogue": "NGC", "type": "Neb", "ra": 0.0, "dec": 0.0,
            "mag": null, "subr": null, "size_max": null, "size_min": null,
            "common": null, "other": null, "constellation": "Cyg",
            "bestMonth": null, "peakAltitude": null, "visibilityStart": null, "visibilityEnd": null,
        })
    }

    fn by_object(conn: &rusqlite::Connection, object: &str) -> serde_json::Value {
        get_all_targets(conn)
            .unwrap()
            .into_iter()
            .find(|t| t["object"] == object)
            .unwrap()
    }

    #[test]
    fn target_round_trips_every_field() {
        let conn = test_conn();
        upsert_target(&conn, &m42()).unwrap();
        assert_eq!(get_all_targets(&conn).unwrap(), vec![m42()]);
    }

    #[test]
    fn nulls_and_zero_coordinates_survive() {
        let conn = test_conn();
        upsert_target(&conn, &sparse()).unwrap();
        assert_eq!(get_all_targets(&conn).unwrap(), vec![sparse()]);
    }

    #[test]
    fn upsert_updates_best_months_in_place() {
        let conn = test_conn();
        upsert_target(&conn, &m42()).unwrap();
        let mut updated = m42();
        updated["bestMonth"] = json!({ "Home": 2 });
        upsert_target(&conn, &updated).unwrap();
        assert_eq!(get_all_targets(&conn).unwrap(), vec![updated]);
    }

    #[test]
    fn bulk_save_inserts_and_updates() {
        let mut conn = test_conn();
        upsert_target(&conn, &m42()).unwrap();
        let mut renamed = m42();
        renamed["common"] = json!("Great Orion Nebula");
        save_targets_bulk(&mut conn, &[renamed.clone(), sparse()]).unwrap();
        assert_eq!(get_all_targets(&conn).unwrap().len(), 2);
        assert_eq!(by_object(&conn, "M 42"), renamed);
    }

    #[test]
    fn bulk_save_is_all_or_nothing() {
        let mut conn = test_conn();
        let mut broken = sparse();
        broken.as_object_mut().unwrap().remove("ra");
        assert_eq!(
            save_targets_bulk(&mut conn, &[m42(), broken]).unwrap_err(),
            "missing ra"
        );
        assert!(get_all_targets(&conn).unwrap().is_empty());
    }

    #[test]
    fn delete_all_empties_the_table() {
        let mut conn = test_conn();
        save_targets_bulk(&mut conn, &[m42(), sparse()]).unwrap();
        delete_all_targets(&conn).unwrap();
        assert!(get_all_targets(&conn).unwrap().is_empty());
    }
}

// ----------------------------------------------------------------------
