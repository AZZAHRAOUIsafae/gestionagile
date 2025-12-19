let map = L.map('map').setView([33.5731, -7.5898], 13);
let marker;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

map.on('click', function(e) {
  if (marker) map.removeLayer(marker);
  marker = L.marker(e.latlng).addTo(map);
  console.log("Lat:", e.latlng.lat, "Lng:", e.latlng.lng);
});
