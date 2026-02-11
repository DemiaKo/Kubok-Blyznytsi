function populateTable(tableId, rowsData) {
  const table = document.getElementById(tableId);
  if (!table || !rowsData) return;
  
  const tbody = table.getElementsByTagName('tbody')[0];
  const tableRows = tbody.rows;
  
  rowsData.forEach((data, index) => {
    if (index < tableRows.length) {
      const cells = tableRows[index].cells;
      cells[0].textContent = data.time;
      cells[1].textContent = data.team1;
      cells[2].textContent = data.score;
      cells[3].textContent = data.team2;
      cells[4].textContent = data.field;
      // В AfterFinal є додаткова колонка Last
      if (cells[5]) cells[5].textContent = data.last;
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  fetch('/api/view/AfterFinal')
    .then(res => res.json())
    .then(data => {
      // Логіка: якщо прапор НЕ Y, повертаємось на index.html
      if (data.flag !== 'Y') {
        localStorage.setItem('1scr', 'B');
        window.location = 'index.html';
        return;
      }

      // Заповнюємо таблиці
      populateTable('U-14', data.tables['14']);
      populateTable('U-17', data.tables['17']); // Тут у вас в HTML id таблиці U-17
      populateTable('U-66', data.tables['66']);
    })
    .catch(err => console.error(err));

  setTimeout(() => { window.location = '2scr.html'; }, 20000);
});