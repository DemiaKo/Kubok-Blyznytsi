// Function to load SecScreen table data with a single API request
function loadSecScreenTableData(tableId, endpoint, ageGroup) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const rows = table.getElementsByTagName('tbody')[0].rows;
  const rowCount = rows.length;
  
  // Send a single request for all rows in this table
  fetch(`/api/table-data/${endpoint}/${ageGroup}/${rowCount}`)
    .then(response => response.json())
    .then(data => {
      // Update all rows at once with the returned data
      data.rows.forEach((rowData, index) => {
        rows[index].cells[1].textContent = rowData.time;
        rows[index].cells[2].textContent = rowData.team1;
        rows[index].cells[3].textContent = rowData.score;
        rows[index].cells[4].textContent = rowData.score2;
        rows[index].cells[5].textContent = rowData.team2;
        rows[index].cells[6].textContent = rowData.field;
      });
      console.log(`Loaded all data for ${tableId} in a single request`);
    })
    .catch(error => {
      console.error(`Error loading data for ${tableId}:`, error);
    });
}

document.addEventListener('DOMContentLoaded', function() {
  var loc = localStorage.getItem("1scr");
  
  // Load all tables at once with single requests
  loadSecScreenTableData('U-14', 'SecScreen', '14');
  loadSecScreenTableData('U-17-A', 'SecScreen', '17A');
  loadSecScreenTableData('U-17-B', 'SecScreen', '17B');
  loadSecScreenTableData('U-66', 'SecScreen', '66');
  
  // Set the timeout for page redirection based on the stored value
  if (loc == "B") {
    setTimeout(() => {window.location = 'index.html';}, 20000);
  } else if (loc == "F") {
    setTimeout(() => {window.location = '1scrF.html';}, 20000);
  }
});