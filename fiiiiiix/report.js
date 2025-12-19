let map = L.map('map').setView([33.57,-7.58],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let marker;

map.on('click',e=>{
  if(marker) map.removeLayer(marker);
  marker = L.marker(e.latlng).addTo(map);
});
