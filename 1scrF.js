function populateTable(tableId, rowsData) {
  const table = document.getElementById(tableId);
  if (!table || !rowsData) return;
  
  const tbody = table.getElementsByTagName('tbody')[0];
  const tableRows = tbody.rows;
  
  rowsData.forEach((data, index) => {
    if (index < tableRows.length) {
      const cells = tableRows[index].cells;
      cells[0].textContent = data.time;   // Час
      cells[1].textContent = data.stage;  // Етап (НОВА КОЛОНКА)
      cells[2].textContent = data.team1;  // Команда 1
      cells[3].textContent = data.score;  // Рахунок
      cells[4].textContent = data.team2;  // Команда 2
      cells[5].textContent = data.field;  // Поле
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