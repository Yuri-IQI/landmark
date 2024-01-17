import { Intermediary } from './komi.js'
const intermediary = new Intermediary();
await intermediary.fetchCityData();

class City {
  constructor() {
    this.citiesPlane = document.getElementById('cities-plane');
    this.routes = document.getElementsByTagName('polyline');
    this.cityConnections = {};
    this.selectedCity = null;
  }

  displayCities() {
    intermediary.cityData.forEach(city => {
      const img = document.createElement('img');
      img.style.position = 'absolute';
      img.src = '../assets/city-pin.svg';
      img.style.left = `${city[2][0]}%`;
      img.style.top = `${city[2][1]}%`;
      img.alt = `${city[1]} (${city[0]})`;
      img.id = `${city[1]}`;
      this.findCityConnections(city, img);

      this.citiesPlane.appendChild(img);
    });
  }

  findCityConnections(city, img) {
    const tolerance = 0.01;
    for (let i = 0; i < this.routes.length; i++) {
      const path = this.routes[i];
      path.id = `${i}`;
      for (const point of path.points) {
        if (Math.abs(city[2][0] - parseFloat(point.x.toFixed(2))) < tolerance && Math.abs(city[2][1] - parseFloat(point.y.toFixed(2))) < tolerance) {
          if (!this.cityConnections[path.id]) {
            this.cityConnections[path.id] = [];
          }
          this.cityConnections[path.id].push([city[0], city[2]]);
          if (!city[3]) {
            city.push([]);
          }
          city[3].push(path.id);
        }
      }
    }
    img.onclick = () => this.selectCity(img);
  }  

  selectCity(img) {
    if (this.selectedCity) {
      for (let key in this.cityConnections) {
        let ids = this.cityConnections[key].map(arr => arr[0]);  
        if (ids.includes(Number(img.alt.match(/\d+/)[0])) && ids.includes(Number(this.selectedCity.alt.match(/\d+/)[0]))) {
          this.selectedCity.style.border = "none";
          img.style.border = "2px dashed darkred";
          img.style.borderRadius = "16px";
          img.style.padding = "2px";
          this.selectedCity = img;
        }
      }
    } else {
      img.style.border = "2px dashed darkred";
      img.style.borderRadius = "16px";
      img.style.padding = "2px";
      this.selectedCity = img;
    }
    console.log(globalRoutesData);
  }
}

class Routes {
  constructor() {
    this.routesData = {};
    this.points = [];
    this.svgElement = document.getElementById('routes');
    this.isDrawing = false;
    this.numPoints = 20;
    this.cityZones = [];
    this.trackMouse();
    this.polylineId = 0;
    this.polyline = null;
  }

  trackMouse() {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Shift') {
        this.isDrawing = !this.isDrawing;
        if (!this.isDrawing) {
          this.points = this.simplifyPath();
          this.drawPolyline();
          this.signForks();
          this.points = [];
          this.polylineId++;
          this.polyline = null;
        }
      }
    });
    this.svgElement.addEventListener('mousedown', (event) => {
      if (this.isDrawing) {
        this.addPoint(event);
        this.svgElement.addEventListener('mousemove', this.handleMouseMove);
      }
    });
    this.svgElement.addEventListener('mouseup', (event) => {
      if (this.isDrawing) {
        this.svgElement.removeEventListener('mousemove', this.handleMouseMove);
      }
    });
  }

  handleMouseMove = (event) => {
    this.addPoint(event);
    this.drawPolyline();
  }

  addPoint(event) {
    let rect = this.svgElement.getBoundingClientRect();
    let x = (event.clientX - rect.left) / rect.width * 100;
    let y = (event.clientY - rect.top) / rect.height * 100;
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      this.points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
  }

  drawPolyline() {
    if (!this.polyline) {
      this.polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      this.polyline.setAttribute('stroke', 'black');
      this.polyline.setAttribute('fill', 'none');
      this.polyline.setAttribute('stroke-width', '0.4');
      this.polyline.setAttribute('stroke-linejoin', 'round');
      this.polyline.setAttribute('stroke-linecap', 'round');
      this.polyline.setAttribute('id', `polyline${this.polylineId}`);
      this.svgElement.appendChild(this.polyline);
    }
    this.polyline.setAttribute('points', this.points.join(' '));
  }

  simplifyPath() {
    let simplifiedPath = [];
    for (let i = 0; i < this.numPoints; i++) {
        let index = Math.floor(i * this.points.length / this.numPoints);
        simplifiedPath.push(this.points[index]);
    }
  
    simplifiedPath = simplifiedPath.map(str => str.split(',').map(Number));
    this.connectToNearCities(simplifiedPath);
  
    return simplifiedPath;
  }

  connectToNearCities(simplifiedPath) {
    for (let i = 0; i < intermediary.cityData.length; i++) {
      let city = intermediary.cityData[i];
      this.cityZones.push(city[2]);
      let margin = 4;
      let closestPointIndex = -1;
      let minDistance = Infinity;
  
      for (let j = 0; j < simplifiedPath.length; j++) {
        let point = simplifiedPath[j];
        let distance = Math.sqrt(Math.pow((point[0]) - (city[2][0]), 2) + Math.pow((point[1]) - (city[2][1]), 2));
        if (distance < minDistance) {
          minDistance = distance;
          closestPointIndex = j;
        }
      }
  
      if (minDistance <= margin) {
        simplifiedPath.splice(closestPointIndex + 1, 0, city[2]);
      }
    }
  }

  async signForks() {
    let margin = 12;
    this.routesData[this.polylineId] = [this.points, []];

    if (Object.keys(this.routesData).length > 1) {
      let routeForks = {};

      for (let polylineId1 in this.routesData) {
        for (let polylineId2 in this.routesData) {
          if (polylineId1 !== polylineId2) {
            let polylinePoints1 = this.routesData[polylineId1][0];
            let polylinePoint2 = this.routesData[polylineId2][0];

            let isForked = polylinePoints1.some((points1, index) => {
              let points2 = polylinePoint2[index];
              return points2 && Math.abs(points1[0] - points2[0]) < margin && Math.abs(points1[1] - points2[1]) < margin;
            });

            if (isForked) {
              if (!routeForks[polylineId1]) {
                routeForks[polylineId1] = [];
              }
              routeForks[polylineId1].push(polylineId2);
            }
          }
        }
      }
      for (let polylineId in routeForks) {
        this.routesData[polylineId][1] = routeForks[polylineId];
      }
    }
    window.globalRoutesData = await intermediary.sendPoints(this.routesData);
  }
}

class Menu {
  constructor() {
    this.elements = {
      swap: document.getElementById('swap-sheets'),
      map: document.getElementById('map-formation'),
      guild: document.getElementById('guild-formation'),
      guildImg: document.getElementById('guild-formation').getElementsByTagName('img'),
      formationSection: document.getElementById('formations')
    };
  }

  toggleElementVisibility(element) {
    element.classList.toggle('visible');
    element.classList.toggle('hidden');
  }

  swapSheets() {
    const { guild, map } = this.elements;
    const isGuildVisible = guild.classList.contains('visible');
    const isMapVisible = map.classList.contains('visible');
  
    if (isGuildVisible !== isMapVisible) {
      this.toggleElementVisibility(guild);
      this.toggleElementVisibility(map);
    }
  }

  adjustSheetStyles(action) {
    const { formationSection, guildImg } = this.elements;
    const imgHeight = action.includes('disable') ? '100%' : '48rem';
    Array.from(guildImg).forEach(img => img.style.height = imgHeight);
    formationSection.style.gap = action.includes('disable') ? '' : '5%';
  }

  displayBothSheets(action) {
    const { guild, map } = this.elements;
    this.adjustSheetStyles(action);
    if (action.includes('guild')) {
      this.toggleElementVisibility(guild);
    } else {
      this.toggleElementVisibility(map);
    }
  }

  openSheets(sheet) {
    const { guild, map } = this.elements;
    const isGuildHidden = guild.classList.contains('hidden');
    const isMapHidden = map.classList.contains('hidden');
    if (sheet === 'guild' && isGuildHidden && !isMapHidden) {
      this.displayBothSheets('enable guild sheet');
    } else if (sheet === 'guild' && !isGuildHidden && !isMapHidden) {
      this.displayBothSheets('disable map sheet');
    } else if (sheet === 'map' && isMapHidden && !isGuildHidden) {
      this.displayBothSheets('enable map sheet');
    } else if (sheet === 'map' && !isGuildHidden && !isMapHidden) {
      this.displayBothSheets('disable guild sheet');
    }
  }
}

var allCoordinates = [];

function getMapCoordinates(event) {
  var mapSheet = document.getElementById("map-sheet");
  var rect = mapSheet.getBoundingClientRect();
  var x = ((event.clientX - rect.left) / rect.width) * 100;
  var y = ((event.clientY - rect.top) / rect.height) * 100;
  var coordinates = "[" + x.toFixed(2) + "%, " + y.toFixed(2) + "%],";
  allCoordinates.push(coordinates);
  
  document.getElementById("coordinates").innerHTML = allCoordinates.join('<br>');
}

document.getElementById("map-sheet").addEventListener("click", function(e) {
  getMapCoordinates(e);
  window.coords = allCoordinates;
});

window.onload = async function() {
  const city = new City();
  city.displayCities();

  const routes = new Routes();

  window.menu = new Menu();
}