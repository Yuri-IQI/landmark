const { invoke } = window.__TAURI__.tauri;

export class Intermediary {
  constructor() {
    this.cityData;
    this.routesData;
  }

  async fetchCityData() {
    try {
      const rawData = await invoke('get_city_data');
      this.cityData = rawData.map(cityString => {
        const parts = cityString.split('-');
        return [parseInt(parts[0].trim()), parts[1].trim(), JSON.parse(parts[2].trim())];
      });
    } catch (error) {
      console.error('Failed to fetch city data:', error);
    }
  }

  async sendRoutesData(routesData, communicate) {
    for (let i in routesData) {
      if (routesData[i][2] === undefined) {
        routesData[i].push(0);
      }      
    }
    const updatedRoutesData = await invoke('manage_routes_data', { routesData, communicate });
  }

  async getRoutesData() {
    let communicate = false;
    this.routesData = await invoke('exchange_routes_data', { communicate });
  }
}