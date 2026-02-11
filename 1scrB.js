// Оптимізована функція для заповнення таблиці даними з пам'яті
function populateTable(tableId, rowsData) {
  const table = document.getElementById(tableId);
  if (!table || !rowsData) return;
  
  const tbody = table.getElementsByTagName('tbody')[0];
  const tableRows = tbody.rows;
  
  // Очищаємо або оновлюємо існуючі рядки
  rowsData.forEach((data, index) => {
    if (index < tableRows.length) {
      const cells = tableRows[index].cells;
      cells[0].textContent = data.time;
      cells[1].textContent = data.team1;
      cells[2].textContent = data.score;
      cells[3].textContent = data.team2;
      cells[4].textContent = data.field;
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  localStorage.setItem('1scr', 'B');

  // ЄДИНИЙ запит на сервер
  fetch('/api/view/BeforeFinal')
    .then(res => res.json())
    .then(data => {
      // 1. Перевірка прапора
      if (data.flag === 'Y') {
        localStorage.setItem('1scr', 'F');
        window.location = '1scrF.html';
        return;
      }

      // 2. Заповнення всіх таблиць одразу
      populateTable('U-14', data.tables['14']);
      populateTable('U-17-A', data.tables['17A']);
      populateTable('U-17-B', data.tables['17B']);
      populateTable('U-66', data.tables['66']);
      
      console.log('All data loaded via single batch request');
    })
    .catch(err => console.error(err));

  // Переадресація
  setTimeout(() => { window.location = '2scr.html'; }, 20000);
});