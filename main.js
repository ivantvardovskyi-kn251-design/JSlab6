const API_BASE_URL = "http://localhost/JSlab6/api.php";

class ApiRepository {
  #baseUrl;
  #type;

  constructor(baseUrl, type) {
    this.#baseUrl = baseUrl;
    this.#type = type;
  }

  async #request(query, options = {}) {
    const response = await fetch(`${this.#baseUrl}?type=${this.#type}${query}`, options);
    if (!response.ok) throw new Error(`Помилка сервера: ${response.status}`);
    return response.json();
  }

  readAll() {
    return this.#request("");
  }

  readById(id) {
    return this.#request(`&id=${id}`);
  }

  create(item) {
    return this.#request("", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
  }

  update(id, changes) {
    return this.#request(`&id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
  }

  delete(id) {
    return this.#request(`&id=${id}`, { method: "DELETE" });
  }
}

const carsApi = new ApiRepository(API_BASE_URL, "car_tvardovskyi");
const tripsApi = new ApiRepository(API_BASE_URL, "trip_tvardovskyi");
const driversApi = new ApiRepository(API_BASE_URL, "driver_tvardovskyi");

const cache = { cars: [], trips: [], drivers: [] };

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector(`#${btn.dataset.tab}`).classList.add("active");
    });
  });
}

function renderTable(containerSelector, items, columns) {
  const container = document.querySelector(containerSelector);
  container.innerHTML = "";

  if (items.length === 0) {
    container.textContent = "Записів немає";
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  columns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col.label;
    headRow.append(th);
  });
  const actionsTh = document.createElement("th");
  actionsTh.textContent = "Дії";
  headRow.append(actionsTh);
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  for (const item of items) {
    tbody.append(renderRow(item, columns));
  }
  table.append(tbody);
  container.append(table);
}

function renderRow(item, columns) {
  const tr = document.createElement("tr");

  columns.forEach(col => {
    const td = document.createElement("td");
    td.textContent = col.format ? col.format(item) : item[col.key];
    tr.append(td);
  });

  const actionsTd = document.createElement("td");
  actionsTd.innerHTML = `
    <button class="edit-btn" data-id="${item.id}">Редагувати</button>
    <button class="delete-btn" data-id="${item.id}">Видалити</button>
  `;
  tr.append(actionsTd);
  return tr;
}

function showStatus(text, isError = false) {
  const bar = document.querySelector("#status-bar");
  bar.textContent = text;
  bar.classList.toggle("error", isError);
  bar.classList.add("show");
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => bar.classList.remove("show"), 2500);
}

const carColumns = [
  { key: "id", label: "ID" },
  { key: "plate", label: "Номер" },
  { key: "brand", label: "Марка" },
  { key: "capacity", label: "Вантажність, т" },
  { key: "fuelPer100", label: "Витрата, л/100 км" },
];

const driverColumns = [
  { key: "id", label: "ID" },
  { key: "fullName", label: "ПІБ" },
  { key: "personnelNumber", label: "Табельний номер" },
  { key: "category", label: "Категорія" },
];

const tripColumns = [
  { key: "id", label: "ID" },
  {
    key: "carId", label: "Автомобіль",
    format: t => {
      const car = cache.cars.find(c => c.id === Number(t.carId));
      return car ? `${car.brand} (${car.plate})` : `#${t.carId}`;
    },
  },
  {
    key: "driverId", label: "Водій",
    format: t => {
      const d = cache.drivers.find(x => x.id === Number(t.driverId));
      return d ? d.fullName : `#${t.driverId}`;
    },
  },
  { key: "departureDate", label: "Виїзд" },
  { key: "returnDate", label: "Повернення" },
  { key: "distance", label: "Відстань, км" },
  { key: "origin", label: "Звідки" },
  { key: "destination", label: "Куди" },
  { key: "cargo", label: "Вантаж" },
  { key: "status", label: "Статус" },
];

async function refreshCars() {
  cache.cars = await carsApi.readAll();
  renderTable("#cars-container", cache.cars, carColumns);
  renderTable("#trips-container", cache.trips, tripColumns);
}

async function refreshDrivers() {
  cache.drivers = await driversApi.readAll();
  renderTable("#drivers-container", cache.drivers, driverColumns);
  renderTable("#trips-container", cache.trips, tripColumns);
}

async function refreshTrips() {
  cache.trips = await tripsApi.readAll();
  renderTable("#trips-container", cache.trips, tripColumns);
}

function fillTripSelects() {
  const form = document.querySelector("#trip-form");
  form.carId.innerHTML = cache.cars
    .map(c => `<option value="${c.id}">${c.brand} (${c.plate})</option>`).join("");
  form.driverId.innerHTML = cache.drivers
    .map(d => `<option value="${d.id}">${d.fullName}</option>`).join("");
}

function setupEntity({ name, api, cacheKey, refresh, readForm, fillForm, titles, beforeOpen }) {
  const addBtn = document.querySelector(`#add-${name}-btn`);
  const form = document.querySelector(`#${name}-form`);
  const formSection = document.querySelector(`#${name}-form-section`);
  const formTitle = formSection.querySelector(".form-title");
  const container = document.querySelector(`#${name}s-container`);
  let editingId = null;

  addBtn.addEventListener("click", () => {
    editingId = null;
    form.reset();
    if (beforeOpen) beforeOpen();
    formTitle.textContent = titles.create;
    formSection.classList.remove("hidden");
  });

  form.querySelector(".cancel-btn").addEventListener("click", () => {
    editingId = null;
    formSection.classList.add("hidden");
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const data = readForm(form);
    try {
      if (editingId) {
        await api.update(editingId, data);
        showStatus(`Запис #${editingId} оновлено`);
        editingId = null;
      } else {
        const created = await api.create(data);
        showStatus(`Створено запис #${created.id}`);
      }
      formSection.classList.add("hidden");
      await refresh();
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  container.addEventListener("click", async event => {
    const id = event.target.dataset.id;
    if (!id) return;

    if (event.target.classList.contains("delete-btn")) {
      const confirmed = confirm(`Видалити запис #${id}?`);
      if (!confirmed) return;
      try {
        await api.delete(id);
        showStatus(`Запис #${id} видалено`);
        await refresh();
      } catch (error) {
        showStatus(error.message, true);
      }
    }

    if (event.target.classList.contains("edit-btn")) {
      const item = cache[cacheKey].find(x => String(x.id) === id);
      if (!item) return;
      editingId = id;
      if (beforeOpen) beforeOpen();
      fillForm(form, item);
      formTitle.textContent = `${titles.edit} #${id}`;
      formSection.classList.remove("hidden");
    }
  });
}

setupEntity({
  name: "car",
  api: carsApi,
  cacheKey: "cars",
  refresh: refreshCars,
  titles: { create: "Новий автомобіль", edit: "Редагування автомобіля" },
  readForm: f => ({
    plate: f.plate.value,
    brand: f.brand.value,
    capacity: Number(f.capacity.value),
    fuelPer100: Number(f.fuelPer100.value),
  }),
  fillForm: (f, c) => {
    f.plate.value = c.plate;
    f.brand.value = c.brand;
    f.capacity.value = c.capacity;
    f.fuelPer100.value = c.fuelPer100;
  },
});

setupEntity({
  name: "driver",
  api: driversApi,
  cacheKey: "drivers",
  refresh: refreshDrivers,
  titles: { create: "Новий водій", edit: "Редагування водія" },
  readForm: f => ({
    fullName: f.fullName.value,
    personnelNumber: f.personnelNumber.value,
    category: f.category.value,
  }),
  fillForm: (f, d) => {
    f.fullName.value = d.fullName;
    f.personnelNumber.value = d.personnelNumber;
    f.category.value = d.category;
  },
});

setupEntity({
  name: "trip",
  api: tripsApi,
  cacheKey: "trips",
  refresh: refreshTrips,
  titles: { create: "Новий рейс", edit: "Редагування рейсу" },
  beforeOpen: fillTripSelects,
  readForm: f => ({
    carId: Number(f.carId.value),
    driverId: Number(f.driverId.value),
    departureDate: f.departureDate.value,
    returnDate: f.returnDate.value,
    distance: Number(f.distance.value),
    origin: f.origin.value,
    destination: f.destination.value,
    cargo: f.cargo.value,
    status: f.status.value,
  }),
  fillForm: (f, t) => {
    f.carId.value = t.carId;
    f.driverId.value = t.driverId;
    f.departureDate.value = t.departureDate;
    f.returnDate.value = t.returnDate;
    f.distance.value = t.distance;
    f.origin.value = t.origin;
    f.destination.value = t.destination;
    f.cargo.value = t.cargo;
    f.status.value = t.status;
  },
});

async function init() {
  initTabs();
  try {
    await Promise.all([refreshCars(), refreshDrivers()]);
    await refreshTrips();
  } catch (error) {
    showStatus(`Не вдалося завантажити дані: ${error.message}`, true);
  }
}

init();
