const form = document.getElementById('dateForm');
const statMessage = document.getElementById('statMessage');

let chart;

flatpickr('#date', {
  dateFormat: 'Y-m-d',
  defaultDate: new Date(),
});

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const selectedDate = document.getElementById('date').value;

    fetch(`/getOffers?date=${encodeURIComponent(selectedDate)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Request failed');
        }
        return response.json();
      })
      .then((data) => {
        if (chart) {
          chart.destroy();
          chart = null;
        }

        if (data.length === 0) {
          statMessage.textContent = 'No prices were added in the selected month.';
          return;
        }
        statMessage.textContent = '';

        const ctx = document.getElementById('graph').getContext('2d');
        chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.map((entry) => entry.date),
            datasets: [{
              label: 'Offer Statistics',
              data: data.map((entry) => entry.offerCount),
              borderColor: 'blue',
              borderWidth: 1,
              fill: false,
            }],
          },
          options: {
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: { precision: 0 },
              },
            },
          },
        });
      })
      .catch((error) => {
        console.error('Error:', error);
        statMessage.textContent = 'The statistics could not be loaded. Try again.';
      });
  });
