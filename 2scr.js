function populateSecTable(tableId, rowsData) {
  const table = document.getElementById(tableId);
  if (!table || !rowsData) return;
  
  const tbody = table.getElementsByTagName('tbody')[0];
  const tableRows = tbody.rows;
  
  rowsData.forEach((data, index) => {
    if (index < tableRows.length) {
      const cells = tableRows[index].cells;
      // У SecScreen інша структура колонок
      cells[1].textContent = data.time;
      cells[2].textContent = data.team1;
      cells[3].textContent = data.score;
      cells[4].textContent = data.score2;
      cells[5].textContent = data.team2;
      cells[6].textContent = data.field;
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const loc = localStorage.getItem("1scr");

  fetch('/api/view/SecScreen')
    .then(res => res.json())
    .then(data => {
      populateSecTable('U-14', data.tables['14']);
      populateSecTable('U-17-A', data.tables['17A']);
      populateSecTable('U-17-B', data.tables['17B']);
      populateSecTable('U-66', data.tables['66']);
    })
    .catch(err => console.error(err));
  
  if (loc == "B") {
    setTimeout(() => { window.location = 'index.html'; }, 20000);
  } else if (loc == "F") {
    setTimeout(() => { window.location = '1scrF.html'; }, 20000);
  }
});