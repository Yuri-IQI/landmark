export class Intermediary {
  constructor() {
    this.cityData;
  }

  async fetchCityData() {
    try {
      const rawData = await window.__TAURI__.tauri.invoke('get_city_data');
      this.cityData = rawData.map(cityString => {
        const parts = cityString.split('-');
        return [parseInt(parts[0].trim()), parts[1].trim(), JSON.parse(parts[2].trim())];
      });
    } catch (error) {
      console.error('Failed to fetch city data:', error);
    }
  }

  async sendPoints(routesData) {
    for (let route in routesData) {
      routesData[route][2] = await window.__TAURI__.tauri.invoke('measure_routes', { routePoints: routesData[route][0] });
    }
  }

}