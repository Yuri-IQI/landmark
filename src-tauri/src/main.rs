//postgres://postgres:12345@localhost:5432/landmark
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::error::Error;
use sqlx::Connection;
use sqlx::Row;

async fn connect_to_database(url: &str) -> Result<sqlx::postgres::PgConnection, Box<dyn Error>> {
    let conn = sqlx::postgres::PgConnection::connect(url).await?;
    Ok(conn)
}

async fn query_select_cities_data(conn: &mut sqlx::postgres::PgConnection) -> Result<Vec<String>, Box<dyn Error>> {
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
    let city_data = query_select_cities_data(&mut conn).await.expect("Failed to execute database query");

    Ok(city_data)
}

#[derive(Debug, serde::Deserialize, serde::Serialize, Clone)]
struct RouteData {
    points: Vec<Vec<f64>>,
    forks: Vec<i32>,
    length: f64,
}

#[tauri::command]
async fn manage_routes_data(mut routes_data: HashMap<String, RouteData>, communicate: bool) -> HashMap<String, RouteData> {
    for route_data in routes_data.values_mut() {
        route_data.length = measure_routes(&route_data.points);
    }

    if communicate {
        exchange_routes_data(Some(routes_data.clone()), communicate).await.unwrap();
    }

    routes_data
}

fn measure_routes(route_points: &Vec<Vec<f64>>) -> f64 {
    let mut route_points_real: Vec<Vec<f64>> = Vec::new();
    for coordinate in route_points {
        let a_real: f64 = (coordinate[0]/100.0) * 200.0;
        let b_real: f64 = (coordinate[1]/100.0) * 200.0;
        route_points_real.push(vec![a_real, b_real]);
    }

    let length = curve_length(&route_points_real);
    //println!("Length of the route: {} km", length);

    length
}

fn curve_length(points: &Vec<Vec<f64>>) -> f64 {
    let mut length = 0.0;

    for i in 0..(points.len() - 1) {
        let dx = points[i + 1][0] - points[i][0];
        let dy = points[i + 1][1] - points[i][1];

        length += (dx * dx + dy * dy).sqrt();
    }

    length
}

#[tauri::command]
async fn exchange_routes_data(routes_data: Option<HashMap<String, RouteData>>, communicate: bool) -> tauri::Result<HashMap<String, RouteData>> {
    let mut result = HashMap::new();

    if let Some(data) = routes_data {
        match query_exchange_routes_data(Some(data.clone()), communicate).await {
            Ok(res) => {
                //println!("{:?}", res);
                result = res;
            },
            Err(e) => {
                println!("Error: {:?}", e);
            }
        }
    } else {
        match query_exchange_routes_data(routes_data.clone(), communicate).await {
            Ok(res) => {
                //println!("{:?}", res);
                result = res;
            },
            Err(e) => {
                println!("Error: {:?}", e);
            }
        }
    }

    Ok(result)
}

async fn query_exchange_routes_data(routes_data: Option<HashMap<String, RouteData>>, communicate: bool) -> Result<HashMap<String, RouteData>, Box<dyn std::error::Error>> {
    let url = "postgres://postgres:12345@localhost:5432/landmark";
    let mut conn = connect_to_database(url).await?;
    let mut routes_data = routes_data.unwrap_or_default();

    if communicate {
        for (key, route) in &routes_data {
            let id = key.parse::<i32>()?;
            let points_string: String = route.points.iter()
                .map(|vec| vec.iter().map(|f| f.to_string()).collect::<Vec<String>>().join(","))
                .collect::<Vec<String>>()
                .join(";");

            sqlx::query("INSERT INTO routes (id, points, forks, length) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET points = $2, forks = $3, length = $4")
                .bind(id)
                .bind(points_string)
                .bind(route.forks.clone())
                .bind(route.length)
                .execute(&mut conn)
                .await?;
        }
    } else {
        let rows = sqlx::query("SELECT * FROM routes").fetch_all(&mut conn).await?;

        routes_data = rows
            .iter()
            .map(|r| {
                let route_id: i32 = r.get("id");
                let route_points: String = r.get("points");
                let route_forks: Vec<i32> = r.get("forks");
                let route_length: f64 = r.get("length");

                let route_points_vec: Vec<Vec<f64>> = route_points.split(';')
                    .map(|s| s.split(',')
                        .map(|f| f.parse::<f64>().unwrap())
                        .collect())
                    .collect();

                let route_data = RouteData {
                    points: route_points_vec,
                    forks: route_forks,
                    length: route_length,
                };

                (route_id.to_string(), route_data)
            })
            .collect();
    }

    Ok(routes_data)
}

#[tokio::main]
async fn main() {

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_city_data, manage_routes_data, exchange_routes_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}