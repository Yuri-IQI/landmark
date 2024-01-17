//postgres://postgres:12345@localhost:5432/landmark
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::error::Error;
use sqlx::Connection;
use sqlx::Row;

async fn connect_to_database(url: &str) -> Result<sqlx::postgres::PgConnection, Box<dyn Error>> {
    let conn = sqlx::postgres::PgConnection::connect(url).await?;
    Ok(conn)
}

async fn execute_query(conn: &mut sqlx::postgres::PgConnection) -> Result<Vec<String>, Box<dyn Error>> {
    let rows = sqlx::query("SELECT id, name, coordinates from cities").fetch_all(conn).await?;

    let city: Vec<String> = rows
        .iter()
        .map(|r| {
            let city_id: i32 = r.get("id");
            let city_name: String = r.get("name");

            let city_coordinates_f64: Vec<f64> = r.get("coordinates");

            let city_coordinates: Vec<String> = city_coordinates_f64.into_iter()
                .map(|f| f.to_string())
                .collect();

            format!("{}-{}-{:?}", city_id, city_name, city_coordinates).replace("\"", "")
        })
        .collect();

    Ok(city)
}

#[tauri::command]
async fn get_city_data() -> tauri::Result<Vec<String>> {
    let url = "postgres://postgres:12345@localhost:5432/landmark";
    let mut conn = connect_to_database(url).await.expect("Failed to connect to database");
    let city_data = execute_query(&mut conn).await.expect("Failed to execute database query");

    Ok(city_data)
}

fn curve_length(points: &Vec<Vec<f32>>) -> f32 {
    let mut length = 0.0;

    for i in 0..(points.len() - 1) {
        let dx = points[i + 1][0] - points[i][0];
        let dy = points[i + 1][1] - points[i][1];

        length += (dx * dx + dy * dy).sqrt();
    }

    length
}

#[tauri::command]
async fn measure_routes(route_points: Vec<Vec<f32>>) -> String {

    let mut route_points_real: Vec<Vec<f32>> = Vec::new();
    for coordinate in &route_points {
        let a_real: f32 = (coordinate[0]/100.0) * 200.0;
        let b_real: f32 = (coordinate[1]/100.0) * 200.0;
        route_points_real.push(vec![a_real, b_real]);
    }

    let route_length = curve_length(&route_points_real);
    println!("Length of the route: {} km", route_length);

    route_length.to_string()
}


#[tokio::main]
async fn main() {
    let _city_data = get_city_data().await.unwrap();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_city_data, measure_routes])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
