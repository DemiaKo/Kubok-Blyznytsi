// Function to load all table data with a single API request
function loadTableData(tableId, endpoint, ageGroup) {
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
          rows[index].cells[0].textContent = rowData.time;
          rows[index].cells[1].textContent = rowData.team1;
          rows[index].cells[2].textContent = rowData.score;
          rows[index].cells[3].textContent = rowData.team2;
          rows[index].cells[4].textContent = rowData.field;
          rows[index].cells[5].textContent = rowData.last;
        });
        console.log(`Loaded all data for ${tableId} in a single request`);
      })
      .catch(error => {
        console.error(`Error loading data for ${tableId}:`, error);
      });
  }
  
  document.addEventListener('DOMContentLoaded', function() {
    // First check if we need to redirect
    fetch(`/api/table-data/BeforeFinal/Y/1`)
      .then(response => response.json())
      .then(data => {
        if (data.flag != 'Y') {
          localStorage.setItem('1scr', 'B');
          window.location = 'index.html';
          return; // Stop execution if redirecting
        }
        
        // Load all tables at once with single requests
        loadTableData('U-14', 'AfterFinal', '14');
        loadTableData('U-17', 'AfterFinal', '17');
        loadTableData('U-66', 'AfterFinal', '66');
      })
      .catch(error => {
        console.error('Error checking redirect flag:', error);
      });
      
  //Set the timeout for page redirection
  setTimeout(() => {window.location = '2scr.html';}, 20000);
  });